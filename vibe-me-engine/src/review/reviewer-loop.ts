import type { ReviewResult } from './session-node.js';
import { terminated } from './session-node.js';
import { assertNever } from '../types/general.js';

export type ReviewerRoundOutcome =
  | { readonly _tag: 'Resolved'; readonly result: ReviewResult }
  | { readonly _tag: 'PromptFailed' }
  | { readonly _tag: 'NoResult' };

export type ReviewerLoopDecision =
  | { readonly _tag: 'Finish'; readonly result: ReviewResult }
  | { readonly _tag: 'Nudge'; readonly nudgeCount: number };

export function resolvedOutcome(result: ReviewResult): ReviewerRoundOutcome {
  return { _tag: 'Resolved', result };
}
export const promptFailedOutcome: ReviewerRoundOutcome = { _tag: 'PromptFailed' };
export const noResultOutcome: ReviewerRoundOutcome = { _tag: 'NoResult' };

export function decideAfterRound(
  nudgeCount: number,
  outcome: ReviewerRoundOutcome,
  maxNudges: number,
): ReviewerLoopDecision {
  switch (outcome._tag) {
    case 'Resolved':
      return { _tag: 'Finish', result: outcome.result };
    case 'PromptFailed':
      return { _tag: 'Finish', result: terminated };
    case 'NoResult': {
      const next = nudgeCount + 1;
      return next >= maxNudges
        ? { _tag: 'Finish', result: terminated }
        : { _tag: 'Nudge', nudgeCount: next };
    }
    default:
      return assertNever(outcome);
  }
}

export type ReviewerPromptPart = { readonly type: 'text'; readonly text: string };

export function reviewerPromptParts(
  nudgeCount: number,
  initialParts: ReviewerPromptPart[],
  nudgePrompt: string,
): ReviewerPromptPart[] {
  return nudgeCount === 0 ? initialParts : [{ type: 'text', text: nudgePrompt }];
}
