import { activateReview, isReviewActive, deactivateReview } from "engine/review";
import type { PluginSlashCommandDefinition } from "../types/tool.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import { delegateToSubAgent } from "../tools/delegate.js";
import { isPassingReviewReport } from "../tools/submitReview.js";
import { REVIEWER_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";

const PRE_REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

function createLoopOnlyCommand(): PluginSlashCommandDefinition {
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

function createLoopReviewCommand(deps: HostDependencies): PluginSlashCommandDefinition {
  return {
    key: "loop-review",
    description:
      "Pre-review task description with a reviewer sub-agent, then activate review loop mode.",
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
        return [
          `Task (loop): ${task}`,
          "",
          "Loop mode is active (pre-review unavailable — no task service). Complete the task above, then call submit_review with:",
          "- report: a detailed description of what you did and why",
          "- affectedFiles: list of every file you modified or created",
          "",
          "A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.",
        ].join("\n");
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
              toolPolicy: {
                disabledTools: [...REVIEWER_SUB_AGENT_DISABLED_TOOLS],
              },
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
        return [
          `Task (loop): ${task}`,
          "",
          "Loop mode is active. Pre-review passed. Complete the task above, then call submit_review with:",
          "- report: a detailed description of what you did and why",
          "- affectedFiles: list of every file you modified or created",
          "",
          "A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.",
        ].join("\n");
      }

      return [
        `Task (loop): ${task}`,
        "",
        "Pre-review feedback:",
        "",
        preReviewReport,
        "",
        "Loop mode is active. Address the pre-review feedback above while completing the task. Then call submit_review with:",
        "- report: a detailed description of what you did and why",
        "- affectedFiles: list of every file you modified or created",
        "",
        "A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.",
      ].join("\n");
    },
  };
}

export function createLoopCommand(deps: HostDependencies): PluginSlashCommandDefinition[] {
  return [createLoopOnlyCommand(), createLoopReviewCommand(deps)];
}