import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import type { ReviewStore } from 'engine/review';
import { REVIEW_INSTRUCTIONS } from 'engine/review';
import {
  registerChildAgent,
  resolveSubsessionParentID,
} from '../utils/child-agent';
import { extractToolContext } from '../utils/tool-context';
import { runReviewerWithNudge } from './reviewer';

export function createSubmitReviewTool(ctx: PluginInput, reviewStore: ReviewStore): ToolDefinition {
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

      if (!sessionID || !reviewStore.isReviewActive(sessionID)) {
        return 'You do not need review. Just continue with your work.';
      }

      if (!reviewStore.tryLockReview(sessionID)) {
        return 'A review is already in progress. Wait for it to finish.';
      }

      try {
        const task = reviewStore.getReviewTask(sessionID);
        const sections = [
          REVIEW_INSTRUCTIONS,
          `=== Change Report ===\n\n${args.report}`,
          `=== Affected Files ===\n\n${args.affectedFiles.join('\n')}`,
          task ? `=== Original Task ===\n\n${task}` : null,
        ];
        const parts: Array<{ type: 'text'; text: string }> = sections
          .filter((text): text is string => text !== null)
          .map((text) => ({ type: 'text' as const, text }));

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
        reviewStore.addChild(sessionID, childID);
        registerChildAgent(childID, 'reviewer', parentID);

        const result = await runReviewerWithNudge(
          client,
          reviewStore,
          childID,
          parts,
          directory,
          abortSignal,
        );

        if (result._tag === 'Accepted') {
          reviewStore.deactivateReview(sessionID);
          return 'Review passed. Your changes have been accepted. loop mode has ended.';
        }

        if (result._tag === 'Terminated') {
          reviewStore.deactivateReview(sessionID);
          return 'Review terminated.';
        }

        return `Review feedback:\n\n${result.feedback}\n\nAddress the feedback above. loop mode is still active — fix the issues and call submit_review again.`;
      } finally {
        reviewStore.unlockReview(sessionID);
      }
    },
  });
}