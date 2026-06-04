import type { JsonSchema, PluginToolArgs, StartReviewLoopToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { requireWorkspaceId } from "../types/contract.js";
import { activateReview } from "engine/review";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    task: {
      type: "string",
      description:
        "Description of the task/reason for entering review loop mode. This is recorded as the original task for review context.",
    },
  },
  required: ["task"],
  additionalProperties: false,
};

export function createStartReviewLoopTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "start_review_loop",
    description:
      "Activate review loop mode for the current session. " +
      "When active, submit_review will create a reviewer sub-agent instead of skipping. " +
      "Use this when the user asks to enter review/loop mode, or when explicitly instructed to start a review loop. " +
      "Call this once at the beginning; the loop stays active until the session ends or is explicitly stopped.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const { task } = args as StartReviewLoopToolArgs;
      const workspaceId = requireWorkspaceId(config, "start_review_loop");
      activateReview(workspaceId, task);
      return "Review loop activated. Use submit_review when you want your work reviewed.";
    },
  };
}
