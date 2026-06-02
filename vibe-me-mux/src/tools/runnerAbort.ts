import type { SchemaFactory, ToolDefinition, RunnerAbortToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { abort } from "engine/runner";

export function createRunnerAbortTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    jobId: f.string("The job ID to abort"),
  });

  return {
    name: "runner_abort",
    description:
      "Forcefully terminate a running background runner task.",
    schema,
    execute: async (_config, args: PluginToolArgs) => {
      const { jobId } = args as RunnerAbortToolArgs;
      return abort(jobId);
    },
  };
}
