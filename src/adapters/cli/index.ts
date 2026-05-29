#!/usr/bin/env node
import { runPlannerCli } from "../../application/index.js";
import {
  FileAgentRunArtifactReader,
  FileAgentRunArtifactWriter,
  FileChangeLogWriter,
  FileContextReader,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FileProjectionReader,
  FileProjectionWriter,
  FileRefinedBriefReader,
  FileRefinedBriefWriter,
  FileWorkspaceInitializer,
  FilePlanningGraphSchemaValidator,
  CodexProcessRunner,
  ProcessValidationCommandRunner
} from "../index.js";

const runnerCommand = readOption(process.argv.slice(2), "--runner-command");

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
  contextFileReader: new FileContextReader(),
  runArtifactReader: new FileAgentRunArtifactReader(),
  runArtifactWriter: new FileAgentRunArtifactWriter(),
  agentRunner: new CodexProcessRunner(runnerCommand),
  validationCommandRunner: new ProcessValidationCommandRunner()
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exitCode = result.exitCode;

function readOption(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
