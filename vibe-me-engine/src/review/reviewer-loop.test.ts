import { describe, it, expect } from 'bun:test';
import {
  resolvedOutcome,
  promptFailedOutcome,
  noResultOutcome,
  decideAfterRound,
  reviewerPromptParts,
  type ReviewerPromptPart,
} from './reviewer-loop.js';
import { accepted, rejected, terminated } from './session-node.js';

describe('decideAfterRound', () => {
  it('finishes with accepted result when resolved', () => {
    const decision = decideAfterRound(0, resolvedOutcome(accepted), 3);
    expect(decision).toEqual({ _tag: 'Finish', result: accepted });
  });

  it('finishes with rejected result when resolved', () => {
    const decision = decideAfterRound(0, resolvedOutcome(rejected('fix')), 3);
    expect(decision._tag).toBe('Finish');
    if (decision._tag === 'Finish') {
      expect(decision.result._tag).toBe('Rejected');
      if (decision.result._tag === 'Rejected') {
        expect(decision.result.feedback).toBe('fix');
      }
    }
  });

  it('finishes terminated on prompt failed at start', () => {
    const decision = decideAfterRound(0, promptFailedOutcome, 3);
    expect(decision).toEqual({ _tag: 'Finish', result: terminated });
  });

  it('finishes terminated on prompt failed at any round', () => {
    const decision = decideAfterRound(2, promptFailedOutcome, 3);
    expect(decision).toEqual({ _tag: 'Finish', result: terminated });
  });

  it('nudges after first no-result', () => {
    const decision = decideAfterRound(0, noResultOutcome, 3);
    expect(decision).toEqual({ _tag: 'Nudge', nudgeCount: 1 });
  });

  it('nudges before reaching max nudges', () => {
    const decision = decideAfterRound(1, noResultOutcome, 3);
    expect(decision).toEqual({ _tag: 'Nudge', nudgeCount: 2 });
  });

  it('terminates when nudge threshold is reached', () => {
    const decision = decideAfterRound(2, noResultOutcome, 3);
    expect(decision).toEqual({ _tag: 'Finish', result: terminated });
  });
});

describe('reviewerPromptParts', () => {
  const initialParts: ReviewerPromptPart[] = [{ type: 'text', text: 'init' }];

  it('returns initial parts on round 0', () => {
    const parts = reviewerPromptParts(0, initialParts, 'NUDGE');
    expect(parts).toEqual([{ type: 'text', text: 'init' }]);
  });

  it('returns nudge prompt on round 1', () => {
    const parts = reviewerPromptParts(1, initialParts, 'NUDGE');
    expect(parts).toEqual([{ type: 'text', text: 'NUDGE' }]);
  });

  it('returns nudge prompt for any later round', () => {
    const parts = reviewerPromptParts(5, initialParts, 'NUDGE');
    expect(parts).toEqual([{ type: 'text', text: 'NUDGE' }]);
  });
});
