import type { JsonSchema, PluginToolArgs, SubmitReviewToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import {
  deactivateReview,
  REVIEW_INSTRUCTIONS,
  isReviewActive,
  tryLockReview,
  unlockReview,
  getReviewTask,
} from "engine/review";
import { delegateToSubAgent } from "./delegate.js";

const AGENT_REPORT_REVIEW_INSTRUCTIONS = REVIEW_INSTRUCTIONS
  .replace(
    /submit_review_result\(\s*\{\s*"feedback"\s*:\s*null\s*\}\s*\)/g,
    'agent_report({ "reportMarkdown": "PASS" })',
  )
  .replace(
    /submit_review_result\(\s*\{\s*"feedback"\s*:\s*"specific\.\.\."\s*\}\s*\)/g,
    'agent_report({ "reportMarkdown": "specific..." })',
  )
  .replace(
    /IMPORTANT:\s*If you accept,\s*feedback MUST be null\.[^.]*\./g,
    'IMPORTANT: If you accept, reportMarkdown MUST be exactly "PASS". Do not write ACCEPT, praise, JSON, or any other text — it will be misinterpreted as rejection feedback.',
  )
  .replace(
    /You MUST call submit_review_result before finishing\./g,
    'You MUST call agent_report before finishing.',
  );

function isPassingReviewReport(report: string): boolean {
  return /^["'*\s]*PASS["'*\s.]*$/i.test(report.trim());
}

function buildReviewPrompt(
  report: string,
  affectedFiles: readonly string[],
  originalTask: string | undefined,
): string {
  return [
    AGENT_REPORT_REVIEW_INSTRUCTIONS,
    "",
    `=== Change Report ===\n\n${report}`,
    "",
    `=== Affected Files ===\n\n${affectedFiles.join("\n")}`,
    originalTask ? `\n=== Original Task ===\n\n${originalTask}` : "",
  ].join("\n");
}

const parameters: JsonSchema = {
  type: "object",
  properties: {
    report: {
      type: "string",
      description: "Detailed report of what was done",
    },
    affectedFiles: {
      type: "array",
      items: {
        type: "string",
        description: "File path that was modified or created",
      },
      description: "List of file paths that were modified or created",
    },
  },
  required: ["report", "affectedFiles"],
  additionalProperties: false,
};

export function createSubmitReviewTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "submit_review",
    description:
      "Submit completed work for review. Creates a reviewer sub-agent that examines the changes against evaluation criteria and returns PASS or actionable feedback. Only works when session is in active loop mode.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as SubmitReviewToolArgs;
      const workspaceId = config.workspaceId;
      if (!workspaceId) throw new Error("submitReview requires workspaceId");

      if (!tryLockReview(workspaceId)) {
        return isReviewActive(workspaceId)
          ? "A review is already in progress for this session."
          : "You do not need review. Just continue with your work.";
      }

      try {
        const originalTask = getReviewTask(workspaceId);
        const reviewPrompt = buildReviewPrompt(
          a.report,
          a.affectedFiles,
          originalTask,
        );
        const reviewReport = await delegateToSubAgent(
          config,
          deps,
          "explore",
          reviewPrompt,
          "Review",
        );

        if (isPassingReviewReport(reviewReport)) {
          deactivateReview(workspaceId);
          return "Review passed. Loop mode ended.";
        }

        return `Review feedback:\n\n${reviewReport}\n\nAddress the feedback above. loop mode is still active; fix the issues and call submit_review again.`;
      } finally {
        unlockReview(workspaceId);
      }
    },
  };
}
