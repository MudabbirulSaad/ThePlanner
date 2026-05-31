import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type {
  ChangedFileEntry,
  ChangedFileSummary,
  WorkspaceChangeSnapshot,
  WorkspaceChangeTracker,
  WorkspaceFileSnapshotEntry
} from "../../application/index.js";

const execFileAsync = promisify(execFile);

export class FileWorkspaceChangeTracker implements WorkspaceChangeTracker {
  public constructor(private readonly rootPath = process.cwd()) {}

  public async captureSnapshot(): Promise<WorkspaceChangeSnapshot> {
    const files = await this.listWorkspaceFiles();
    return {
      files: await snapshotFiles(this.rootPath, files)
    };
  }

  public async summarizeChanges(baseline: WorkspaceChangeSnapshot): Promise<ChangedFileSummary> {
    const current = await this.captureSnapshot();
    return summarizeSnapshotChanges(baseline, current);
  }

  private async listWorkspaceFiles(): Promise<readonly string[]> {
    const gitFiles = await listGitWorkspaceFiles(this.rootPath);
    if (gitFiles) {
      return gitFiles;
    }

    return await listFilesystemWorkspaceFiles(this.rootPath);
  }
}

async function listGitWorkspaceFiles(rootPath: string): Promise<readonly string[] | undefined> {
  try {
    const root = (await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: rootPath })).stdout.trim();
    const output = await execFileAsync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root
    });
    return output.stdout
      .split("\0")
      .filter((path) => path.length > 0)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return undefined;
  }
}

async function listFilesystemWorkspaceFiles(rootPath: string): Promise<readonly string[]> {
  const files: string[] = [];
  await collectFiles(rootPath, rootPath, files);
  return files.sort((left, right) => left.localeCompare(right));
}

async function collectFiles(rootPath: string, directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rootPath, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(toWorkspacePath(rootPath, absolutePath));
  }
}

async function snapshotFiles(
  rootPath: string,
  paths: readonly string[]
): Promise<readonly WorkspaceFileSnapshotEntry[]> {
  const entries: WorkspaceFileSnapshotEntry[] = [];
  for (const path of paths) {
    const hash = await hashFileIfPresent(resolve(rootPath, path));
    if (hash) {
      entries.push({ path, hash });
    }
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function hashFileIfPresent(path: string): Promise<string | undefined> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile()) {
      return undefined;
    }

    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function summarizeSnapshotChanges(
  baseline: WorkspaceChangeSnapshot,
  current: WorkspaceChangeSnapshot
): ChangedFileSummary {
  const before = new Map(baseline.files.map((file) => [file.path, file.hash]));
  const after = new Map(current.files.map((file) => [file.path, file.hash]));
  const files: ChangedFileEntry[] = [];

  for (const [path, hash] of after.entries()) {
    const previousHash = before.get(path);
    if (previousHash === undefined) {
      files.push({ path, status: "created" });
    } else if (previousHash !== hash) {
      files.push({ path, status: "modified" });
    }
  }

  for (const path of before.keys()) {
    if (!after.has(path)) {
      files.push({ path, status: "deleted" });
    }
  }

  files.sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status));

  return {
    files,
    created: files.filter((file) => file.status === "created").map((file) => file.path),
    modified: files.filter((file) => file.status === "modified").map((file) => file.path),
    deleted: files.filter((file) => file.status === "deleted").map((file) => file.path)
  };
}

function toWorkspacePath(rootPath: string, absolutePath: string): string {
  return relative(rootPath, absolutePath).split(sep).join("/");
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
