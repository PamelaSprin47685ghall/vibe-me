import { describe, expect, it } from 'vitest';
import { transition } from './state.ts';
import {
  inactive,
  activeReview,
  lockedReview,
  acceptedReview,
  rejectedReview,
  activateCommand,
  submitCommand,
  lockCommand,
  unlockCommand,
  acceptCommand,
  rejectCommand,
  type ReviewState,
  type ReviewCommand,
} from '../types/review.ts';

describe('review state transitions', () => {
  it('handles every ReviewState × ReviewCommand combination', () => {
    const task = 'review-task';
    const reviewerId = 'reviewer-1';
    const feedback = 'rejected-feedback';

    const states: ReviewState[] = [
      inactive,
      activeReview(task),
      lockedReview(task, reviewerId),
      acceptedReview(),
      rejectedReview(feedback),
    ];

    const commands: ReviewCommand[] = [
      activateCommand(task),
      submitCommand,
      lockCommand(reviewerId),
      unlockCommand,
      acceptCommand,
      rejectCommand(feedback),
    ];

    const validStateTags = ['Inactive', 'Active', 'Locked', 'Accepted', 'Rejected'] as readonly string[];

    for (const state of states) {
      for (const command of commands) {
        const [nextState, event] = transition(state, command);

        expect(validStateTags).toContain(nextState._tag);

        const expected = expectedOutcome(state, command);
        if (expected.defined) {
          expect(nextState._tag as string).toBe(expected.stateTag);
          expect(event).not.toBeNull();
          expect(event!._tag as string).toBe(expected.eventTag);
        } else {
          expect(nextState).toBe(state);
          expect(event).toBeNull();
        }
      }
    }
  });
});

function expectedOutcome(
  state: ReviewState,
  command: ReviewCommand,
):
  | { readonly defined: true; readonly stateTag: string; readonly eventTag: string }
  | { readonly defined: false } {
  switch (state._tag) {
    case 'Inactive':
      switch (command._tag) {
        case 'Activate':
          return { defined: true, stateTag: 'Active', eventTag: 'Activated' };
        default:
          return { defined: false };
      }
    case 'Active':
      switch (command._tag) {
        case 'Submit':
          return { defined: true, stateTag: 'Active', eventTag: 'Submitted' };
        case 'Lock':
          return { defined: true, stateTag: 'Locked', eventTag: 'LockAcquired' };
        case 'Accept':
          return { defined: true, stateTag: 'Accepted', eventTag: 'Accepted' };
        case 'Reject':
          return { defined: true, stateTag: 'Rejected', eventTag: 'Rejected' };
        default:
          return { defined: false };
      }
    case 'Locked':
      switch (command._tag) {
        case 'Unlock':
          return { defined: true, stateTag: 'Active', eventTag: 'LockReleased' };
        case 'Accept':
          return { defined: true, stateTag: 'Accepted', eventTag: 'Accepted' };
        case 'Reject':
          return { defined: true, stateTag: 'Rejected', eventTag: 'Rejected' };
        default:
          return { defined: false };
      }
    case 'Accepted':
      return { defined: false };
    case 'Rejected':
      return { defined: false };
  }
}
