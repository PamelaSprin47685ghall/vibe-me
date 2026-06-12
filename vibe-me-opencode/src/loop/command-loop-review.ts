import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import { REVIEW_INSTRUCTIONS } from 'engine/review';
import { registerChildAgent, resolveSubsessionParentID } from '../utils/child-agent';
import { LOOP_REVIEW_COMMAND_NAME } from './constants';
import { runReviewerWithNudge } from './reviewer';

export async function handleLoopReview(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  input: { command: string; sessionID: string; arguments: string },
  output: { parts: Array<{ type: string; text?: string }> },
): Promise<void> {
  if (input.command !== LOOP_REVIEW_COMMAND_NAME) return;

  output.parts.length = 0;

  const task = input.arguments.trim();
  if (!task) {
    reviewStore.deactivateReview(input.sessionID);
    output.parts.push({ type: 'text', text: 'loop-review mode cancelled.' });
    return;
  }

  const sessionID = input.sessionID;

  if (reviewStore.isReviewActive(sessionID)) {
    output.parts.push({
      type: 'text',
      text: 'loop mode is already active. Submit your work via submit_review.',
    });
    return;
  }

  const parentID = resolveSubsessionParentID(sessionID);
  const createResult = await ctx.client.session.create({
    query: { directory: ctx.directory },
    body: { parentID, title: 'Pre-Reviewer' },
  });
  const childID = createResult.data?.id;
  if (!childID) {
    output.parts.push({ type: 'text', text: 'Failed to create pre-reviewer session' });
    return;
  }
  reviewStore.addChild(sessionID, childID);
  registerChildAgent(childID, 'reviewer', parentID);

  const parts: Array<{ type: 'text'; text: string }> = [
    { type: 'text', text: REVIEW_INSTRUCTIONS },
    { type: 'text', text: `=== Task ===\n\n${task}` },
  ];

  const result = await runReviewerWithNudge(ctx.client, reviewStore, childID, parts, ctx.directory);

  if (result._tag === 'Accepted') {
    output.parts.push({
      type: 'text',
      text: `Pre-review passed. Task "${task}" already meets all criteria — no changes needed.`,
    });
    return;
  }

  if (result._tag === 'Terminated') {
    output.parts.push({
      type: 'text',
      text: 'Pre-review could not complete.',
    });
    return;
  }

  reviewStore.activateReview(sessionID, task);

  output.parts.push({
    type: 'text',
    text:
      `Task (loop-review): ${task}\n\n` +
      `=== Pre-review Feedback ===\n\n${result.feedback}\n\n` +
      'Address the feedback above, then call submit_review with:\n' +
      '- report: a detailed description of what you did and why\n' +
      '- affectedFiles: list of every file you modified or created\n\n' +
      'A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.',
  });
}