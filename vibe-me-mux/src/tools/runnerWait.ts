import type { JsonSchema, PluginToolArgs, RunnerWaitToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { wait } from "engine/runner";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    jobId: {
      type: "string",
      description: "The job ID to wait for",
    },
    ms: {
      type: "number",
      description: "Time to wait in milliseconds",
    },
  },
  required: ["jobId"],
  additionalProperties: false,
};

export function createRunnerWaitTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "runner_wait",
    description:
      "Wait for a background runner task to produce more output or finish.",
    parameters,
    execute: async (_config, args: PluginToolArgs) => {
      const { jobId, ms } = args as RunnerWaitToolArgs;
      const result = await wait({
        sessionId: jobId,
        ms: ms ?? 2000,
      });
      const output =
        result.output + (result.message ? "\n\n" + result.message : "");
      return output || "(no new output)";
    },
  };
}
