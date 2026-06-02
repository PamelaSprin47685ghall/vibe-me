import { tool } from "ai";
import { z } from "zod";
import { abort } from "engine/runner";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";

const RunnerAbortToolInputSchema = z.object({
  jobId: z.string().describe("The job ID to abort"),
});

export const createRunnerAbortTool: ToolFactory = (_config: PluginToolConfiguration) => {
  return tool({
    description: "Forcefully terminate a running background runner task.",
    inputSchema: RunnerAbortToolInputSchema,
    execute: (args) => {
      return abort(args.jobId);
    },
  });
};
