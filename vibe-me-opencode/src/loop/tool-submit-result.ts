import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { resolvePendingReview } from 'engine/review';

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