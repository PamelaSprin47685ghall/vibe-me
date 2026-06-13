import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewResult, ReviewStore } from 'engine/review';
import {
  formatAcceptedResult,
  formatFeedbackResult,
  formatTerminatedResult,
} from './format.js';
import { createAndRegisterChild } from './session.js';
import { defaultDeps, type LoopReviewDeps } from './types.js';

function buildPreReviewParts(
  reviewInstructions: string,
  task: string,
): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: reviewInstructions },
    { type: 'text', text: `=== Task ===\n\n${task}` },
  ];
}

function handleReviewResult(
  reviewStore: ReviewStore,
  sessionID: string,
  task: string,
  result: ReviewResult,
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps,
): void {
  if (result._tag === 'Accepted') {
    output.parts.push({ type: 'text', text: formatAcceptedResult(task) });
    return;
  }

  if (result._tag === 'Terminated') {
    output.parts.push({ type: 'text', text: formatTerminatedResult() });
    return;
  }

  reviewStore.activateReview(sessionID, task, deps.now());
  output.parts.push({
    type: 'text',
    text: formatFeedbackResult(task, result.feedback),
  });
}

async function runPreReview(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  sessionID: string,
  task: string,
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps,
): Promise<void> {
  const childID = await createAndRegisterChild(
    ctx,
    reviewStore,
    sessionID,
    deps,
  );
  if (!childID) {
    output.parts.push({
      type: 'text',
      text: 'Failed to create pre-reviewer session',
    });
    return;
  }

  const parts = buildPreReviewParts(deps.reviewInstructions, task);
  const result = await deps.runReviewerWithNudge(
    ctx.client,
    reviewStore,
    childID,
    parts,
  );

  handleReviewResult(reviewStore, sessionID, task, result, output, deps);
}

export async function handleLoopReview(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  input: { command: string; sessionID: string; arguments: string },
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps = defaultDeps(ctx),
): Promise<void> {
  if (input.command !== deps.loopReviewCommandName) return;

  output.parts.length = 0;

  const task = input.arguments.trim();
  if (!task) {
    reviewStore.deactivateReview(input.sessionID);
    output.parts.push({
      type: 'text',
      text: 'loop-review mode cancelled.',
    });
    return;
  }

  if (reviewStore.isReviewActive(input.sessionID)) {
    output.parts.push({
      type: 'text',
      text: 'loop mode is already active. Submit your work via submit_review.',
    });
    return;
  }

  await runPreReview(ctx, reviewStore, input.sessionID, task, output, deps);
}
