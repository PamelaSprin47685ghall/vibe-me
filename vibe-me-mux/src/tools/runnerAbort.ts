import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface RunnerAbortToolArgs {
  readonly jobId: string;
}
import type { HostDependencies } from "../types/deps.js";
import { abort } from "engine/runner";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    jobId: {
      type: "string",
      description: "The job ID to abort",
    },
  },
  required: ["jobId"],
  additionalProperties: false,
};

export function createRunnerAbortTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "runner_abort",
    description:
      "Forcefully terminate a running background runner task.",
    parameters,
    execute: async (_config, args: Record<string, unknown>) => {
      const { jobId } = args as unknown as RunnerAbortToolArgs;
      return abort(jobId);
    },
  };
}
