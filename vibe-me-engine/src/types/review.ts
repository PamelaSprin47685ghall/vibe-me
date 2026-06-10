export type Inactive = { readonly _tag: 'Inactive' };
export type ActiveReview = {
  readonly _tag: 'Active';
  readonly task: string;
};
export type LockedReview = {
  readonly _tag: 'Locked';
  readonly task: string;
  readonly reviewerId: string;
};
export type CompletedReview = {
  readonly _tag: 'Completed';
  readonly accepted: boolean;
  readonly feedback?: string;
};
export type ReviewState = Inactive | ActiveReview | LockedReview | CompletedReview;

export const inactive: Inactive = { _tag: 'Inactive' };

export function activeReview(task: string): ActiveReview {
  return { _tag: 'Active', task };
}

export function lockedReview(task: string, reviewerId: string): LockedReview {
  return { _tag: 'Locked', task, reviewerId };
}
export function completedReview(accepted: boolean, feedback?: string): CompletedReview {
  return { _tag: 'Completed', accepted, ...(feedback !== undefined ? { feedback } : {}) };
}

export function matchReviewState<R>(
  state: ReviewState,
  patterns: {
    readonly Inactive: () => R;
    readonly Active: (state: ActiveReview) => R;
    readonly Locked: (state: LockedReview) => R;
    readonly Completed: (state: CompletedReview) => R;
  },
): R {
  switch (state._tag) {
    case 'Inactive': return patterns.Inactive();
    case 'Active': return patterns.Active(state);
    case 'Locked': return patterns.Locked(state);
    case 'Completed': return patterns.Completed(state);
  }
}


export type ActivateCommand = {
  readonly _tag: 'Activate';
  readonly task: string;
};
export type SubmitCommand = { readonly _tag: 'Submit' };
export type LockCommand = {
  readonly _tag: 'Lock';
  readonly reviewerId: string;
};
export type UnlockCommand = { readonly _tag: 'Unlock' };
export type CompleteReviewCommand = {
  readonly _tag: 'Complete';
  readonly accepted: boolean;
  readonly feedback?: string;
};
export type ReviewCommand =
  | ActivateCommand
  | SubmitCommand
  | LockCommand
  | UnlockCommand
  | CompleteReviewCommand;

export function activateCommand(task: string): ActivateCommand {
  return { _tag: 'Activate', task };
}
export const submitCommand: SubmitCommand = { _tag: 'Submit' };
export function lockCommand(reviewerId: string): LockCommand {
  return { _tag: 'Lock', reviewerId };
}
export const unlockCommand: UnlockCommand = { _tag: 'Unlock' };
export function completeReviewCommand(
  accepted: boolean,
  feedback?: string,
): CompleteReviewCommand {
  return { _tag: 'Complete', accepted, ...(feedback !== undefined ? { feedback } : {}) };
}

export function matchReviewCommand<R>(
  command: ReviewCommand,
  patterns: {
    readonly Activate: (cmd: ActivateCommand) => R;
    readonly Submit: () => R;
    readonly Lock: (cmd: LockCommand) => R;
    readonly Unlock: () => R;
    readonly Complete: (cmd: CompleteReviewCommand) => R;
  },
): R {
  switch (command._tag) {
    case 'Activate': return patterns.Activate(command);
    case 'Submit': return patterns.Submit();
    case 'Lock': return patterns.Lock(command);
    case 'Unlock': return patterns.Unlock();
    case 'Complete': return patterns.Complete(command);
  }
}


export type ActivatedEvent = {
  readonly _tag: 'Activated';
  readonly task: string;
};
export type SubmittedEvent = { readonly _tag: 'Submitted' };
export type LockAcquiredEvent = {
  readonly _tag: 'LockAcquired';
  readonly reviewerId: string;
};
export type LockReleasedEvent = { readonly _tag: 'LockReleased' };
export type CompletedReviewEvent = {
  readonly _tag: 'Completed';
  readonly accepted: boolean;
  readonly feedback?: string;
};
export type ReviewEvent =
  | ActivatedEvent
  | SubmittedEvent
  | LockAcquiredEvent
  | LockReleasedEvent
  | CompletedReviewEvent;

export function activatedEvent(task: string): ActivatedEvent {
  return { _tag: 'Activated', task };
}
export const submittedEvent: SubmittedEvent = { _tag: 'Submitted' };
export function lockAcquiredEvent(reviewerId: string): LockAcquiredEvent {
  return { _tag: 'LockAcquired', reviewerId };
}
export const lockReleasedEvent: LockReleasedEvent = { _tag: 'LockReleased' };
export function completedReviewEvent(
  accepted: boolean,
  feedback?: string,
): CompletedReviewEvent {
  return {
    _tag: 'Completed',
    accepted,
    ...(feedback !== undefined ? { feedback } : {}),
  };
}

export function matchReviewEvent<R>(
  event: ReviewEvent,
  patterns: {
    readonly Activated: (ev: ActivatedEvent) => R;
    readonly Submitted: () => R;
    readonly LockAcquired: (ev: LockAcquiredEvent) => R;
    readonly LockReleased: () => R;
    readonly Completed: (ev: CompletedReviewEvent) => R;
  },
): R {
  switch (event._tag) {
    case 'Activated': return patterns.Activated(event);
    case 'Submitted': return patterns.Submitted();
    case 'LockAcquired': return patterns.LockAcquired(event);
    case 'LockReleased': return patterns.LockReleased();
    case 'Completed': return patterns.Completed(event);
  }
}
