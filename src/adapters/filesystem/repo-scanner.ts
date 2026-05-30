import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import type {
  RepoScanCommand,
  RepoScanComponent,
  RepoScanContext,
  RepoScanDocument,
  RepoScanner
} from "../../application/index.js";

const ignoredDirectoryNames = new Set([
  ".git",
  ".theplanner",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
  ".turbo",
  ".vite"
]);

const knownPlanningDirectories = new Set(["planning", "issues"]);
const knownDocDirectories = new Set(["docs", "adr"]);
const knownSourceDirectories = new Set(["src", "app", "lib", "server", "client", "packages", "tests"]);
const safeRootFiles = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "GEMINI.md",
  "LICENSE",
  "README.md",
  "package.json",
  "pnpm-workspace.yaml",
  "planner.config.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts"
]);
const safeExtensions = new Set([".md", ".json", ".toml", ".yaml", ".yml"]);
const maxFileBytes = 128 * 1024;
const maxDepth = 4;

export class FileRepoScanner implements RepoScanner {
  public constructor(private readonly rootPath = ".") {}

  public async scan(): Promise<RepoScanContext> {
    const root = resolve(this.rootPath);
    const files = await collectSafeFiles(root);
    const fileSet = new Set(files);
    const packageJson = await readPackageJson(root, fileSet);

    return {
      rootPath: this.rootPath,
      projectTypes: detectProjectTypes(fileSet, packageJson),
      commands: commandsFromPackageJson(packageJson),
      relevantDocs: await collectDocuments(root, files),
      planningFiles: files.filter(isPlanningFile),
      components: await collectComponents(root),
      ignoredDirectories: [...ignoredDirectoryNames].sort(),
      scannedFiles: files
    };
  }
}

async function collectSafeFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = join(directory, entry.name);
      const relativePath = toPosixPath(relative(root, absolutePath));
      if (entry.isDirectory()) {
        if (ignoredDirectoryNames.has(entry.name)) {
          continue;
        }
        await visit(absolutePath, depth + 1);
        continue;
      }

      if (!entry.isFile() || !isSafeFile(relativePath)) {
        continue;
      }

      const metadata = await stat(absolutePath);
      if (metadata.size <= maxFileBytes) {
        files.push(relativePath);
      }
    }
  }

  await visit(root, 0);
  return files.sort();
}

function isSafeFile(path: string): boolean {
  const segments = path.split("/");
  const fileName = segments.at(-1) ?? "";
  if (fileName.startsWith(".env") || fileName.includes("secret") || fileName.includes("credential")) {
    return false;
  }

  if (segments.length === 1 && safeRootFiles.has(fileName)) {
    return true;
  }

  if (segments[0] && (knownPlanningDirectories.has(segments[0]) || knownDocDirectories.has(segments[0]))) {
    return safeExtensions.has(extensionOf(fileName));
  }

  return false;
}

async function readPackageJson(root: string, fileSet: ReadonlySet<string>): Promise<PackageJson | undefined> {
  if (!fileSet.has("package.json")) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(join(root, "package.json"), "utf8")) as PackageJson;
  } catch {
    return undefined;
  }
}

function detectProjectTypes(fileSet: ReadonlySet<string>, packageJson: PackageJson | undefined): readonly string[] {
  const projectTypes = new Set<string>();
  if (packageJson) {
    projectTypes.add("node");
  }
  if (fileSet.has("tsconfig.json")) {
    projectTypes.add("typescript");
  }
  if (fileSet.has("vite.config.ts")) {
    projectTypes.add("vite");
  }
  if (fileSet.has("planner.config.json") || fileSet.has("planning/graph.json")) {
    projectTypes.add("theplanner");
  }
  return [...projectTypes].sort();
}

function commandsFromPackageJson(packageJson: PackageJson | undefined): readonly RepoScanCommand[] {
  if (!packageJson?.scripts || typeof packageJson.scripts !== "object") {
    return [];
  }

  return Object.entries(packageJson.scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, command]) => ({
      name,
      command,
      sourcePath: "package.json"
    }));
}

async function collectDocuments(root: string, files: readonly string[]): Promise<readonly RepoScanDocument[]> {
  const documents = await Promise.all(
    files.filter(isRelevantDocument).map(async (path) => {
      const content = await readFile(join(root, path), "utf8");
      const headings = markdownHeadings(content);
      return {
        path,
        title: headings[0] ?? null,
        headings: headings.slice(0, 12)
      };
    })
  );

  return documents.sort((left, right) => left.path.localeCompare(right.path));
}

function isRelevantDocument(path: string): boolean {
  return path.endsWith(".md") && (path === "README.md" || path === "CONTEXT.md" || path === "AGENTS.md" || path.startsWith("docs/"));
}

function markdownHeadings(content: string): readonly string[] {
  return content
    .split(/\r?\n/u)
    .map((line) => /^(?<marks>#{1,3})\s+(?<title>.+)$/u.exec(line)?.groups?.title.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function isPlanningFile(path: string): boolean {
  return path.startsWith("planning/") || path.startsWith("issues/");
}

async function collectComponents(root: string): Promise<readonly RepoScanComponent[]> {
  const components = new Map<string, RepoScanComponent>();

  for (const topLevel of [...knownSourceDirectories].sort()) {
    const topLevelPath = join(root, topLevel);
    if (!(await directoryExists(topLevelPath))) {
      continue;
    }

    components.set(topLevel, {
      path: topLevel,
      kind: topLevel === "tests" ? "test-area" : "source-area"
    });

    const entries = await readdir(topLevelPath, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory() && !ignoredDirectoryNames.has(entry.name)) {
        const path = `${topLevel}/${entry.name}`;
        components.set(path, {
          path,
          kind: topLevel === "tests" ? "test-area" : "source-area"
        });
      }
    }
  }

  return [...components.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index);
}

function toPosixPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

interface PackageJson {
  readonly scripts?: Record<string, unknown>;
}
