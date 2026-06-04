import type { JsonSchema, PluginToolArgs, SubmitReviewToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import {
  isReviewActive,
  tryLockReview,
  unlockReview,
  getReviewTask,
} from "engine/review";
import { delegateToSubAgent } from "./delegate.js";

const REVIEW_CRITERIA = `## Review Criteria

1. **Correctness** - Does the code correctly implement the requirements? No logical errors, off-by-one, or race conditions?
2. **Completeness** - Does it fully address the original task scope? No missing files or omitted edge cases?
3. **Code Quality** - Is the code clean, well-structured, and maintainable? Appropriate abstractions, no dead code, minimal complexity?
4. **Error Handling** - Are error states, edge cases, and unexpected inputs properly handled? Graceful degradation?
5. **Security** - Any injection risks, credential leaks, traversal vulnerabilities, or unsafe data flows?
6. **Performance** - Any obvious performance issues (N+1 queries, unnecessary allocations, redundant I/O)?
7. **Testing** - Are the changes testable? Do existing tests still pass? Are new tests added where warranted?
8. **Documentation** - Is the rationale documented? Are public APIs, config keys, or behavioral changes explained?`;

const REVIEW_INSTRUCTIONS = `You are an expert code reviewer. Evaluate the submitted changes against the criteria below.

Your job is to:
1. Read the original task and change report
2. Examine the affected files for each criterion
3. Submit a structured verdict using the agent_report tool

Be thorough and fair. Approved work must meet all relevant criteria. If you find issues, clearly describe what needs to change and why.`;

function buildReviewPrompt(
  report: string,
  affectedFiles: readonly string[],
  originalTask: string,
): string {
  return `${REVIEW_INSTRUCTIONS}

${REVIEW_CRITERIA}

## Original Task
${originalTask}

## Change Report
${report}

## Affected Files
${affectedFiles.map((f) => `- ${f}`).join("\n")}

## Instructions
Review the above changes against the criteria. Examine the affected files and evaluate each criterion.
Call agent_report with your structured verdict when done.`;
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
      "Submit completed work for review. Creates a reviewer sub-agent that examines the changes against evaluation criteria and provides structured feedback. Only works when session is in active loop mode.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as SubmitReviewToolArgs;
      const workspaceId = config.workspaceId;
      if (!workspaceId) throw new Error("submitReview requires workspaceId");

      if (!isReviewActive(workspaceId)) {
        return "You do not need review. Just continue with your work.";
      }

      if (!tryLockReview(workspaceId)) {
        return "A review is already in progress for this session.";
      }

      try {
        const originalTask =
          getReviewTask(workspaceId) ?? "No original task recorded.";
        const reviewPrompt = buildReviewPrompt(
          a.report,
          a.affectedFiles,
          originalTask,
        );
        return await delegateToSubAgent(
          config,
          deps,
          "explore",
          reviewPrompt,
          "Review",
        );
      } finally {
        unlockReview(workspaceId);
      }
    },
  };
}
