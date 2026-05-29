#!/usr/bin/env node
import { runPlannerCli } from "../../application/index.js";
import {
  FileChangeLogWriter,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FileProjectionReader,
  FileProjectionWriter,
  FileWorkspaceInitializer
} from "../index.js";

const result = await runPlannerCli(process.argv.slice(2), {
  graphRepository: new FilePlanningGraphRepository(),
  projectionWriter: new FileProjectionWriter(),
  projectionReader: new FileProjectionReader(),
  changeLogWriter: new FileChangeLogWriter(),
  workspaceInitializer: new FileWorkspaceInitializer(),
  intakeIdeaReader: new FileIntakeIdeaReader()
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exitCode = result.exitCode;
