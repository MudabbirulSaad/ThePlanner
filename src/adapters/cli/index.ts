#!/usr/bin/env node
import { runPlannerCli } from "../../application/index.js";
import {
  FileChangeLogWriter,
  FileContextReader,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FileProjectionReader,
  FileProjectionWriter,
  FileRefinedBriefReader,
  FileRefinedBriefWriter,
  FileWorkspaceInitializer,
  FilePlanningGraphSchemaValidator
} from "../index.js";

const result = await runPlannerCli(process.argv.slice(2), {
  graphRepository: new FilePlanningGraphRepository(),
  graphSchemaValidator: new FilePlanningGraphSchemaValidator(),
  projectionWriter: new FileProjectionWriter(),
  projectionReader: new FileProjectionReader(),
  changeLogWriter: new FileChangeLogWriter(),
  workspaceInitializer: new FileWorkspaceInitializer(),
  intakeIdeaReader: new FileIntakeIdeaReader(),
  refinedBriefReader: new FileRefinedBriefReader(),
  refinedBriefWriter: new FileRefinedBriefWriter(),
  contextFileReader: new FileContextReader()
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exitCode = result.exitCode;
