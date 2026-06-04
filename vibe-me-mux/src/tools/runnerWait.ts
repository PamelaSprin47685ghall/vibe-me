import type { SchemaFactory, ToolDefinition, RunnerWaitToolArgs, PluginToolArgs } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { wait } from "engine/runner";

export function createRunnerWaitTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    jobId: f.string("The job ID to wait for"),
    ms: f.number(
      "Time to wait in milliseconds",
    ),
  });

  return {
    name: "runner_wait",
    description:
      "Wait for a background runner task to produce more output or finish.",
    schema,
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
