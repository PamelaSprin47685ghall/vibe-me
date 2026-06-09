import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import {
  deactivateReview,
  getReviewTask,
  isReviewActive,
  REVIEW_INSTRUCTIONS,
  tryLockReview,
  unlockReview,
  resolvePendingReview,
} from 'engine/review';
import {
  lookupChildAgent,
  registerChildAgent,
  resolveSubsessionParentID,
} from '../utils/child-agent';
import { addChild } from 'engine/review';
import { extractToolContext } from '../utils/tool-context';
import { runReviewerWithNudge } from './reviewer';

export function createSubmitReviewResultTool(): ToolDefinition {
  return tool({
    description:
      'Submit your review verdict.\n' +
      '\n' +
      'null feedback = accept. Non-null feedback = reject with specific feedback.',

    args: {
      feedback: tool.schema
        .string()
        .nullable()
        .describe(
          'null = accept. Non-null = reject with specific actionable feedback.',
        ),
    },

    async execute(args, context) {
      const feedback =
        args.feedback == null
          ? null
          : args.feedback.trim().length === 0
            ? null
            : args.feedback;

      const resolved = resolvePendingReview(context.sessionID, {
        accepted: feedback == null,
        feedback: feedback ?? undefined,
      });
      if (!resolved) {
        return 'Error: No pending review to resolve.';
      }

      return feedback == null
        ? 'Review submitted: accepted.'
        : 'Review submitted: rejected with feedback.';
    },
  });
}

export function createSubmitReviewTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description:
      'Submit work for review. Only available during loop mode (activated by /loop).',

    args: {
      report: tool.schema
        .string()
        .min(1)
        .describe('Detailed report of what was done'),
      affectedFiles: tool.schema
        .array(tool.schema.string())
        .describe('List of file paths that were modified or created'),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );

      if (!sessionID || !isReviewActive(sessionID)) {
        return 'You do not need review. Just continue with your work.';
      }

      if (!tryLockReview(sessionID)) {
        return 'A review is already in progress. Wait for it to finish.';
      }

      try {
        const parts: Array<{ type: 'text'; text: string }> = [];

        parts.push({
          type: 'text',
          text: REVIEW_INSTRUCTIONS,
        });

        parts.push({
          type: 'text',
          text: `=== Change Report ===\n\n${args.report}`,
        });

        parts.push({
          type: 'text',
          text: `=== Affected Files ===\n\n${args.affectedFiles.join('\n')}`,
        });

        const task = getReviewTask(sessionID);
        if (task) {
          parts.push({
            type: 'text',
            text: `=== Original Task ===\n\n${task}`,
          });
        }

        const parentID = resolveSubsessionParentID(sessionID);
        const createResult = await client.session.create({
          query: { directory },
          body: {
            parentID,
            title: 'Reviewer',
          },
        });
        const childID = createResult.data?.id;
        if (!childID) {
          return 'Failed to create reviewer session';
        }
        addChild(sessionID, childID);
        registerChildAgent(childID, 'reviewer', parentID);

        const result = await runReviewerWithNudge(
          client,
          childID,
          parts,
          directory,
          abortSignal,
        );

        if (result.feedback == null) {
          deactivateReview(sessionID);
          return 'Review passed. Your changes have been accepted. loop mode has ended.';
        }

        if (result.terminated) {
          deactivateReview(sessionID);
          return `Review terminated: ${result.feedback}`;
        }

        return `Review feedback:\n\n${result.feedback}\n\nAddress the feedback above. loop mode is still active — fix the issues and call submit_review again.`;
      } finally {
        unlockReview(sessionID);
      }
    },
  });
}
