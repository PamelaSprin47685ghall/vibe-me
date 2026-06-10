import { activateReview, deactivateReview, isReviewActive } from "engine/review";
import type { PluginSlashCommandDefinition } from "../types/tool.js";
import { buildLoopMessage } from "./loop-message.js";

export function createLoopOnlyCommand(): PluginSlashCommandDefinition {
  return {
    key: "loop",
    description: "Activate review loop mode. AI completes task, submits for review.",
    inputHint: "<task description>",
    async execute(workspaceId, args) {
      const task = args.trim();
      if (!task) {
        deactivateReview(workspaceId);
        return "Loop mode cancelled.";
      }

      if (isReviewActive(workspaceId)) {
        return "Loop mode is already active. Submit your work via submit_review.";
      }

      activateReview(workspaceId, task);
      return buildLoopMessage(task, "Loop mode is active. Complete the task above, then call submit_review with:");
    },
  };
}