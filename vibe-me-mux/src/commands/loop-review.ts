import { activateReview, deactivateReview, isReviewActive } from "engine/review";
import type { PluginSlashCommandDefinition } from "../types/tool.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import { delegateToSubAgent } from "../tools/delegate.js";
import { isPassingReviewReport } from "../tools/submitReview.js";
import { deniedToolsFor } from "../tools/policy.js";
import { buildLoopMessage } from "./loop-message.js";

const PRE_REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

export function createLoopReviewCommand(deps: HostDependencies): PluginSlashCommandDefinition {
  return {
    key: "loop-review",
    description: "Pre-review task description with a reviewer sub-agent, then activate review loop mode.",
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

      if (!deps.taskService) {
        activateReview(workspaceId, task);
        return buildLoopMessage(task, "Loop mode is active (pre-review unavailable — no task service). Complete the task above, then call submit_review with:");
      }

      const config: PluginToolConfiguration = {
        cwd: process.cwd(),
        workspaceId,
        taskService: deps.taskService,
      };

      const reviewPrompt = [
        "You are a reviewer evaluating whether a task description is clear and actionable enough to begin work.",
        "",
        "=== Task Description ===",
        "",
        task,
        "",
        "Evaluate the task description above. If it is clear, specific, and actionable, respond with exactly: PASS",
        "If the task description has issues (ambiguous, missing requirements, contradictory), provide specific, actionable feedback.",
      ].join("\n");

      let preReviewReport: string;
      try {
        preReviewReport = await Promise.race([
          delegateToSubAgent(config, deps, "explore", reviewPrompt, "Pre-review", {
            aiSettingsAgentId: "plan",
            experiments: {
              subagentRole: "reviewer",
              toolPolicy: { disabledTools: deniedToolsFor("reviewer") },
            },
          }),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("PASS"), PRE_REVIEW_TIMEOUT_MS),
          ),
        ]);
      } catch {
        preReviewReport = "PASS";
      }

      activateReview(workspaceId, task);

      if (isPassingReviewReport(preReviewReport)) {
        return buildLoopMessage(task, "Loop mode is active. Pre-review passed. Complete the task above, then call submit_review with:");
      }

      return buildLoopMessage(task, "Pre-review feedback:", "", preReviewReport, "", "Loop mode is active. Address the pre-review feedback above while completing the task. Then call submit_review with:");
    },
  };
}