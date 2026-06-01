import { tool } from "ai";
import { z } from "zod";
import { wait } from "engine/runner";
import type { ToolConfiguration, ToolFactory } from "../types/tool";

const RunnerWaitToolInputSchema = z.object({
  jobId: z.string().describe("The job ID to wait for"),
  ms: z.number().int().min(100).max(30000).default(2000).describe("Time to wait in milliseconds"),
});

export const createRunnerWaitTool: ToolFactory = (_config: ToolConfiguration) => {
  return tool({
    description: "Wait for a background runner task to produce more output or finish.",
    inputSchema: RunnerWaitToolInputSchema,
    execute: async (args) => {
      const result = await wait({ sessionId: args.jobId, ms: args.ms });
      const output = result.output + (result.message ? "\n\n" + result.message : "");
      return output || "(no new output)";
    },
  });
};
