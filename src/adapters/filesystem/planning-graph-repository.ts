import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { parsePlanningGraphJson, serializePlanningGraphJson } from "../../application/index.js";
import type {
  AgentRunArtifactFile,
  AgentRunArtifactReader,
  AgentRunArtifactWriter,
  ChangeLogWriter,
  ContextFileReader,
  GraphRepository,
  IntakeIdeaReader,
  PlanningChangeLogEvent,
  ProjectionReader,
  ProjectionWriter,
  RefinedBriefReader,
  RefinedBriefWriter,
  RefinedBriefWriteStatus,
  WorkspaceInitializer,
  WorkspaceEntryStatus
} from "../../application/index.js";
import type { PlanningGraph } from "../../core/index.js";
import type { RenderedProjection } from "../../core/index.js";

export class FilePlanningGraphRepository implements GraphRepository {
  public constructor(private readonly graphPath = "planning/graph.json") {}

  public async load() {
    return parsePlanningGraphJson(await this.loadJson());
  }

  public async loadJson(): Promise<unknown> {
    const source = await readFile(resolve(this.graphPath), "utf8");
    return JSON.parse(source);
  }

  public async loadIfExists(): Promise<PlanningGraph | undefined> {
    try {
      return await this.load();
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }

  public async save(graph: PlanningGraph): Promise<void> {
    const resolvedPath = resolve(this.graphPath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
  }
}

export class FileProjectionWriter implements ProjectionWriter {
  public constructor(private readonly mapPath: (path: string) => string = identityPath) {}

  public async writeAll(projections: readonly RenderedProjection[]): Promise<readonly string[]> {
    const writtenPaths: string[] = [];
    for (const projection of projections) {
      const requestedPath = this.mapPath(projection.path);
      const resolvedPath = await resolveProjectionPath(requestedPath);
      const absolutePath = resolve(resolvedPath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, projection.content, "utf8");
      writtenPaths.push(resolvedPath);
    }
    return writtenPaths;
  }
}

export class FileProjectionReader implements ProjectionReader {
  public constructor(private readonly mapPath: (path: string) => string = identityPath) {}

  public async readMany(paths: readonly string[]) {
    const projections = await Promise.all(
      paths.map(async (path) => {
        const resolvedPath = await resolveProjectionPath(this.mapPath(path));
        return {
          path: resolvedPath,
          content: await readFile(resolve(resolvedPath), "utf8")
        };
      })
    );
    return projections;
  }

  public async readExistingMany(paths: readonly string[]) {
    const projections = await Promise.all(
      paths.map(async (path) => {
        const resolvedPath = await resolveProjectionPath(this.mapPath(path));
        try {
          return {
            requestedPath: path,
            path: resolvedPath,
            content: await readFile(resolve(resolvedPath), "utf8")
          };
        } catch (error) {
          if (isNotFound(error)) {
            return {
              requestedPath: path,
              path: resolvedPath
            };
          }
          throw error;
        }
      })
    );
    return projections;
  }
}

export class FileChangeLogWriter implements ChangeLogWriter {
  public constructor(private readonly path = "planning/change-log.ndjson") {}

  public async append(event: PlanningChangeLogEvent): Promise<void> {
    const resolvedPath = resolve(this.path);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await appendFile(resolvedPath, `${JSON.stringify(event)}\n`, "utf8");
  }
}

export class FileAgentRunArtifactWriter implements AgentRunArtifactWriter {
  public constructor(private readonly mapPath: (path: string) => string = identityPath) {}

  public async writeAll(files: readonly AgentRunArtifactFile[]): Promise<readonly string[]> {
    const writtenPaths: string[] = [];
    for (const file of files) {
      const mappedPath = this.mapPath(file.path);
      const resolvedPath = resolve(mappedPath);
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, file.content, { encoding: "utf8", flag: "wx" });
      writtenPaths.push(mappedPath);
    }

    return writtenPaths;
  }
}

export class FileAgentRunArtifactReader implements AgentRunArtifactReader {
  public constructor(private readonly mapPath: (path: string) => string = identityPath) {}

  public async read(path: string): Promise<string> {
    const mappedPath = this.mapPath(path);
    try {
      return await readFile(resolve(mappedPath), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(`Agent run artifact not found: ${mappedPath}`);
      }
      throw error;
    }
  }
}

export class FileIntakeIdeaReader implements IntakeIdeaReader {
  public async read(path: string): Promise<string> {
    try {
      return await readFile(resolve(path), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(`Intake idea file not found: ${path}`);
      }
      throw error;
    }
  }
}

export class FileRefinedBriefReader implements RefinedBriefReader {
  public async read(path: string): Promise<string> {
    try {
      return await readFile(resolve(path), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(`Refined brief file not found: ${path}`);
      }
      throw error;
    }
  }
}

export class FileContextReader implements ContextFileReader {
  public async readIfExists(path: string): Promise<string | undefined> {
    try {
      return await readFile(resolve(path), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }
}

export class FileRefinedBriefWriter implements RefinedBriefWriter {
  public async write(
    path: string,
    content: string,
    options: { readonly overwrite?: boolean } = {}
  ): Promise<RefinedBriefWriteStatus> {
    const resolvedPath = resolve(path);
    await mkdir(dirname(resolvedPath), { recursive: true });

    if (options.overwrite) {
      try {
        await writeFile(resolvedPath, content, { encoding: "utf8", flag: "wx" });
        return "created";
      } catch (error) {
        if (!isAlreadyExists(error)) {
          throw error;
        }
      }

      await writeFile(resolvedPath, content, "utf8");
      return "overwritten";
    }

    try {
      await writeFile(resolvedPath, content, { encoding: "utf8", flag: "wx" });
      return "created";
    } catch (error) {
      if (isAlreadyExists(error)) {
        return "skipped";
      }
      throw error;
    }
  }
}

export class FileWorkspaceInitializer implements WorkspaceInitializer {
  public constructor(private readonly mapPath: (path: string) => string = identityPath) {}

  public async ensureDirectory(path: string): Promise<WorkspaceEntryStatus> {
    const createdPath = await mkdir(resolve(this.mapPath(path)), { recursive: true });
    return createdPath ? "created" : "existing";
  }

  public async writeFileIfMissing(path: string, content: string): Promise<WorkspaceEntryStatus> {
    const resolvedPath = resolve(this.mapPath(path));
    await mkdir(dirname(resolvedPath), { recursive: true });

    try {
      await writeFile(resolvedPath, content, { encoding: "utf8", flag: "wx" });
      return "created";
    } catch (error) {
      if (isAlreadyExists(error)) {
        return "existing";
      }
      throw error;
    }
  }
}

function identityPath(path: string): string {
  return path;
}

async function resolveProjectionPath(path: string): Promise<string> {
  try {
    await readFile(resolve(path), "utf8");
    return path;
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  const id = /^(?<id>wi-[0-9]{3})-/u.exec(basename(path))?.groups?.id;
  if (!id) {
    return path;
  }

  const directory = dirname(path);
  let entries: string[];
  try {
    entries = await readdir(resolve(directory));
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
    return path;
  }

  const candidates = entries.filter((entry) => entry.startsWith(`${id}-`) && entry.endsWith(".md"));
  return candidates.length === 1 ? `${directory}/${candidates[0]}` : path;
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}
