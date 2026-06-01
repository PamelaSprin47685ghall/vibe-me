import { tool } from "ai";
import { z } from "zod";
import type { ToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { isReviewActive, tryLockReview, unlockReview, getReviewTask } from "engine/review";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

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

const SubmitReviewInputSchema = z.object({
  report: z.string().min(1).describe("Detailed report of what was done"),
  affectedFiles: z.array(z.string()).describe("List of file paths that were modified or created"),
});

function buildReviewPrompt(report: string, affectedFiles: string[], originalTask: string): string {
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

export const createSubmitReviewTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description:
      "Submit completed work for review. Creates a reviewer sub-agent that examines the changes against evaluation criteria and provides structured feedback. Only works when session is in active loop mode.",
    inputSchema: SubmitReviewInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "submitReview");
      const taskService = requireTaskService(config, "submitReview");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "explore");

      if (!isReviewActive(workspaceId)) {
        return "You do not need review. Just continue with your work.";
      }

      if (!tryLockReview(workspaceId)) {
        return "A review is already in progress for this session.";
      }

      const originalTask = getReviewTask(workspaceId) ?? "No original task recorded.";
      const reviewPrompt = buildReviewPrompt(args.report, args.affectedFiles, originalTask);

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt: reviewPrompt,
        title: "Review",
      });

      if (!createResult.success) {
        unlockReview(workspaceId);
        return `Failed to create review task: ${createResult.error}`;
      }

      const taskId = createResult.data.taskId;

      try {
        const result = await taskService.waitForAgentReport(taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Review task (${taskId}) moved to background. Check it later via task tools.`;
        }
        throw error;
      } finally {
        unlockReview(workspaceId);
      }
    },
  });
};
