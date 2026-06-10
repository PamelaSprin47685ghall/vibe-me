import {
  type ReviewState,
  type ReviewCommand,
  type ReviewEvent,
  inactive,
  activeReview,
  lockedReview,
  completedReview,
  activatedEvent,
  submittedEvent,
  lockAcquiredEvent,
  lockReleasedEvent,
  completedReviewEvent,
  matchReviewState,
  matchReviewCommand,
} from '../types/review.js';

// ── transition ──────────────────────────────────────────────────────────────
// Pure state machine: given a current state and a command, returns the next
// state (or same state for invalid transitions) and an optional event.

export function transition(
  state: ReviewState,
  command: ReviewCommand,
): [ReviewState, ReviewEvent | null] {
  return matchReviewState<[ReviewState, ReviewEvent | null]>(state, {
    Inactive: () =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: (cmd: any) => [activeReview(cmd.task), activatedEvent(cmd.task)],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [state, null],
        Complete: () => [state, null],
      }),
    Active: (s: any) =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, submittedEvent],
        Lock: (cmd: any) => [lockedReview(s.task, cmd.reviewerId), lockAcquiredEvent(cmd.reviewerId)],
        Unlock: () => [state, null],
        Complete: (cmd: any) => [completedReview(cmd.accepted, cmd.feedback), completedReviewEvent(cmd.accepted, cmd.feedback)],
      }),
    Locked: (s: any) =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [activeReview(s.task), lockReleasedEvent],
        Complete: (cmd: any) => [completedReview(cmd.accepted, cmd.feedback), completedReviewEvent(cmd.accepted, cmd.feedback)],
      }),
    Completed: () =>
      matchReviewCommand<[ReviewState, ReviewEvent | null]>(command, {
        Activate: () => [state, null],
        Submit: () => [state, null],
        Lock: () => [state, null],
        Unlock: () => [state, null],
        Complete: () => [state, null],
      }),
  });
}

// ── isActive ────────────────────────────────────────────────────────────────
// Returns true when a review is in progress (Active or Locked).

export function isActive(state: ReviewState): boolean {
  return matchReviewState(state, {
    Inactive: () => false,
    Active: () => true,
    Locked: () => true,
    Completed: () => false,
  });
}

// ── canStartReview ──────────────────────────────────────────────────────────
// Returns true only when no review is active (Inactive), so a new one may begin.

export function canStartReview(state: ReviewState): boolean {
  return matchReviewState(state, {
    Inactive: () => true,
    Active: () => false,
    Locked: () => false,
    Completed: () => false,
  });
}

// ── createInitialState ──────────────────────────────────────────────────────
// Returns the starting state: Inactive.

export function createInitialState(): ReviewState {
  return inactive;
}
