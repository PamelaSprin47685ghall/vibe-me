import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireWorkspaceId } from "../types/contract.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import { REVIEW_INSTRUCTIONS } from "engine/review";
import { deniedToolsFor } from "./policy.js";
import type { DelegateOptions } from "./delegate.js";
import { requireString, requireStringArray } from "./args.js";

export const FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME =
  "ForegroundWaitBackgroundedError";

export function isForegroundWaitBackgroundedError(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    error.name === FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME
  );
}

export interface ReviewDeps {
  readonly reviewStore: import('engine/review').ReviewStore;
  readonly delegateToSubAgent: (
    config: PluginToolConfiguration,
    deps: HostDependencies,
    agentId: string,
    prompt: string,
    title: string,
    options?: DelegateOptions,
  ) => Promise<string>;
}

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

export function isPassingReviewReport(report: string): boolean {
  const trimmed = report.trim();
  if (/\b(REJECT|FAIL|DENIED|DO NOT ACCEPT)\b/i.test(trimmed)) return false;
  const passIndex = trimmed.search(/\bPASS\b/i);
  if (passIndex >= 0 && passIndex < 200) {
    const afterPass = trimmed.slice(passIndex + 4);
    if (!/\bFAIL\b/i.test(afterPass)) return true;
  }
  return false;
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

export function createSubmitReviewTool(deps: HostDependencies, reviewDeps: ReviewDeps): ToolDefinition {
  return {
    name: "submit_review",
    description:
      "Submit completed work for review. Creates a reviewer sub-agent that examines the changes against evaluation criteria and returns PASS or actionable feedback. Only works when session is in active loop mode.",
    parameters,
    execute: async (config, args) => {
      const reportResult = requireString(args, 'report');
      if (reportResult._tag === 'Err') return reportResult.error;
      const affectedFilesResult = requireStringArray(args, 'affectedFiles');
      if (affectedFilesResult._tag === 'Err') return affectedFilesResult.error;
      const workspaceIdResult = requireWorkspaceId(config, 'submit_review');
      if (workspaceIdResult._tag === 'Err') return workspaceIdResult.error;
      const deniedToolsResult = deniedToolsFor("reviewer");
      if (deniedToolsResult._tag === 'Err') return deniedToolsResult.error;
      const report = reportResult.value;
      const affectedFiles = affectedFilesResult.value;
      const workspaceId = workspaceIdResult.value;

      if (!reviewDeps.reviewStore.tryLockReview(workspaceId)) {
        return reviewDeps.reviewStore.isReviewActive(workspaceId)
          ? "A review is already in progress for this session."
          : "You do not need review. Just continue with your work.";
      }

      try {
        const originalTask = reviewDeps.reviewStore.getReviewTask(workspaceId);
        const reviewPrompt = buildReviewPrompt(
          report,
          affectedFiles,
          originalTask,
        );
        const reviewReport = await reviewDeps.delegateToSubAgent(
          config,
          deps,
          "explore",
          reviewPrompt,
          "Review",
          {
            aiSettingsAgentId: "plan",
            experiments: {
              subagentRole: "reviewer",
              toolPolicy: {
                disabledTools: deniedToolsResult.value,
              },
            },
          },
        );

        if (isPassingReviewReport(reviewReport)) {
          reviewDeps.reviewStore.deactivateReview(workspaceId);
          return "Review passed. Loop mode ended.";
        }

        return `Review feedback:\n\n${reviewReport}\n\nAddress the feedback above. loop mode is still active; fix the issues and call submit_review again.`;
      } finally {
        reviewDeps.reviewStore.unlockReview(workspaceId);
      }
    },
  };
}
