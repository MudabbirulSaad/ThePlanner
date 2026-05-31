import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  GraphOperationProposer,
  GraphOperationProposerInput,
  GraphOperationProposerResult
} from "../../application/index.js";
import { parseLlmGraphOperationProposalResponse } from "./provider-proposal-parser.js";

export type FileGraphOperationProposerMode = "proposal-response" | "proposal";

export interface FileGraphOperationProposerOptions {
  readonly path: string;
  readonly mode: FileGraphOperationProposerMode;
}

export class FileGraphOperationProposer implements GraphOperationProposer {
  public constructor(private readonly options: FileGraphOperationProposerOptions) {}

  public async propose(_input: GraphOperationProposerInput): Promise<GraphOperationProposerResult> {
    const source = await this.readSource();

    if (this.options.mode === "proposal-response") {
      return parseLlmGraphOperationProposalResponse(source, `Graph Operation proposer response file ${this.options.path}`);
    }

    return {
      proposals: [
        {
          sourceReference: this.options.path,
          operation: this.parseProposalJson(source)
        }
      ]
    };
  }

  private async readSource(): Promise<string> {
    try {
      return await readFile(resolve(this.options.path), "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(`Graph Operation proposer file not found: ${this.options.path}`);
      }
      throw error;
    }
  }

  private parseProposalJson(source: string): unknown {
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new Error(
        `Graph Operation proposal file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function isNotFound(error: unknown): error is { readonly code: "ENOENT" } {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
