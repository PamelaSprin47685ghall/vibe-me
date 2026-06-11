import {
  type ReviewState,
  type ReviewCommand,
  type ReviewEvent,
  inactive,
  activeReview,
  lockedReview,
  acceptedReview,
  rejectedReview,
  activatedEvent,
  submittedEvent,
  lockAcquiredEvent,
  lockReleasedEvent,
  acceptedEvent,
  rejectedEvent,
  matchReviewState,
  matchReviewCommand,
} from '../types/review.js';

export function transition(
  state: ReviewState,
  command: ReviewCommand,
): [ReviewState, ReviewEvent | null] {
  return matchReviewState<[ReviewState, ReviewEvent | null]>(state, {
    Inactive: () =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: (cmd) => [activeReview(cmd.task), activatedEvent(cmd.task)],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [state, null],
        Accept: () => [state, null],
        Reject: () => [state, null],
      }),
    Active: (s) =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, submittedEvent],
        Lock: (cmd) => [lockedReview(s.task, cmd.reviewerId), lockAcquiredEvent(cmd.reviewerId)],
        Unlock: () => [state, null],
        Accept: () => [acceptedReview(), acceptedEvent],
        Reject: (cmd) => [rejectedReview(cmd.feedback), rejectedEvent(cmd.feedback)],
      }),
    Locked: (s) =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [activeReview(s.task), lockReleasedEvent],
        Accept: () => [acceptedReview(), acceptedEvent],
        Reject: (cmd) => [rejectedReview(cmd.feedback), rejectedEvent(cmd.feedback)],
      }),
    Accepted: () =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [state, null],
        Accept: () => [state, null],
        Reject: () => [state, null],
      }),
    Rejected: () =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [state, null],
        Accept: () => [state, null],
        Reject: () => [state, null],
      }),
  });
}

export function isActive(state: ReviewState): boolean {
  return matchReviewState(state, {
    Inactive: () => false,
    Active: () => true,
    Locked: () => true,
    Accepted: () => false,
    Rejected: () => false,
  });
}

export function createInitialState(): ReviewState {
  return inactive;
}