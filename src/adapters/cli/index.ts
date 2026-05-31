#!/usr/bin/env node
import { runPlannerCli } from "../../application/index.js";
import type { PlannerConfig } from "../../application/index.js";
import {
  FileAgentRunArtifactReader,
  FileAgentRunArtifactWriter,
  FileChangeLogWriter,
  FileContextReader,
  FileGraphOperationProposalReader,
  FileGraphOperationUserAnswerReader,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FileProjectionReader,
  FileProjectionWriter,
  FileRefinedBriefReader,
  FileRefinedBriefWriter,
  FileWorkspaceInitializer,
  FilePlanningGraphSchemaValidator,
  FileRepoScanner,
  FileWorkspaceChangeTracker,
  GitHubDryRunTrackerSyncAdapter,
  FileGraphOperationProposer,
  createPlanningPathMapper,
  createLocalAgentRunner,
  loadFilePlannerConfig,
  ProcessValidationCommandRunner
} from "../index.js";

const args = process.argv.slice(2);
const runnerCommand = readOption(args, "--runner-command");
const proposalResponsePath = readOption(args, "--proposal-response");
const proposalPath = readOption(args, "--proposal");
const configPath = readOption(args, "--config") ?? "planner.config.json";
let config: PlannerConfig;

try {
  config = await loadFilePlannerConfig(configPath);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
  process.exit();
}

const mapPlanningPath = createPlanningPathMapper(config.planningDirectory);
const graphOperationProposer = createGraphOperationProposer(proposalResponsePath, proposalPath);

const result = await runPlannerCli(args, {
  graphRepository: new FilePlanningGraphRepository(`${config.planningDirectory}/graph.json`),
  graphSchemaValidator: new FilePlanningGraphSchemaValidator(`${config.planningDirectory}/graph.schema.json`),
  projectionWriter: new FileProjectionWriter(mapPlanningPath),
  projectionReader: new FileProjectionReader(mapPlanningPath),
  changeLogWriter: new FileChangeLogWriter(`${config.planningDirectory}/change-log.ndjson`),
  workspaceInitializer: new FileWorkspaceInitializer(mapPlanningPath),
  intakeIdeaReader: new FileIntakeIdeaReader(),
  refinedBriefReader: new FileRefinedBriefReader(),
  refinedBriefWriter: new FileRefinedBriefWriter(),
  graphOperationProposalReader: new FileGraphOperationProposalReader(),
  ...(graphOperationProposer ? { graphOperationProposer } : {}),
  graphOperationUserAnswerReader: new FileGraphOperationUserAnswerReader(),
  contextFileReader: new FileContextReader(),
  runArtifactReader: new FileAgentRunArtifactReader(mapPlanningPath),
  runArtifactWriter: new FileAgentRunArtifactWriter(mapPlanningPath),
  agentRunner: createLocalAgentRunner({
    commandOverride: runnerCommand,
    commands: config.agentCommands,
    timeoutMs: config.agentRunnerTimeoutMs,
    outputLimitBytes: config.processOutputLimitBytes
  }),
  validationCommandRunner: new ProcessValidationCommandRunner({
    timeoutMs: config.validationCommandTimeoutMs,
    outputLimitBytes: config.processOutputLimitBytes
  }),
  workspaceChangeTracker: new FileWorkspaceChangeTracker(),
  trackerSyncAdapters: [new GitHubDryRunTrackerSyncAdapter()],
  repoScanner: new FileRepoScanner(),
  defaultAgent: config.defaultAgent,
  defaultValidationCommands: config.validationCommands
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

function createGraphOperationProposer(
  proposalResponsePath: string | undefined,
  proposalPath: string | undefined
): FileGraphOperationProposer | undefined {
  if (proposalResponsePath && proposalPath) {
    process.stderr.write("theplanner accepts only one of --proposal-response or --proposal\n");
    process.exitCode = 1;
    process.exit();
  }

  if (proposalResponsePath) {
    return new FileGraphOperationProposer({ path: proposalResponsePath, mode: "proposal-response" });
  }

  if (proposalPath) {
    return new FileGraphOperationProposer({ path: proposalPath, mode: "proposal" });
  }

  return undefined;
}
