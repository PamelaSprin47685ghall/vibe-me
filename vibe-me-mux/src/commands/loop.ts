import { activateReview, isReviewActive, deactivateReview } from "engine/review";
import type { PluginSlashCommandDefinition } from "../types/tool.js";

export function createLoopCommand(): PluginSlashCommandDefinition {
  return {
    key: "loop",
    description:
      "Activate review loop mode. AI completes task, submits for review.",
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
      return [
        `Task (loop): ${task}`,
        "",
        "Loop mode is active. Complete the task above, then call submit_review with:",
        "- report: a detailed description of what you did and why",
        "- affectedFiles: list of every file you modified or created",
        "",
        "A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.",
      ].join("\n");
    },
  };
}
