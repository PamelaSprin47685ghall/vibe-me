import { tool } from "ai";
import { z } from "zod";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";
import { requireWorkspaceId } from "../types/tool";
import { activateReview } from "engine/review";

const StartReviewLoopInputSchema = z.object({
  task: z.string().min(1).describe("Description of the task/reason for entering review loop mode. This is recorded as the original task for review context."),
});

export const createStartReviewLoopTool: ToolFactory = (config: PluginToolConfiguration) => {
  return tool({
    description:
      "Activate review loop mode for the current session. " +
      "When active, submit_review will create a reviewer sub-agent instead of skipping. " +
      "Use this when the user asks to enter review/loop mode, or when explicitly instructed to start a review loop. " +
      "Call this once at the beginning; the loop stays active until the session ends or is explicitly stopped.",
    inputSchema: StartReviewLoopInputSchema,
    execute: (args) => {
      const workspaceId = requireWorkspaceId(config, "start_review_loop");
      activateReview(workspaceId, args.task);
      return "Review loop activated. Use submit_review when you want your work reviewed.";
    },
  });
};
