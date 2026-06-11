export type Inactive = { readonly _tag: 'Inactive' };
export type ActiveReview = { readonly _tag: 'Active'; readonly task: string };
export type LockedReview = { readonly _tag: 'Locked'; readonly task: string; readonly reviewerId: string };
export type AcceptedReview = { readonly _tag: 'Accepted' };
export type RejectedReview = { readonly _tag: 'Rejected'; readonly feedback: string };
export type ReviewState = Inactive | ActiveReview | LockedReview | AcceptedReview | RejectedReview;

export const inactive: Inactive = { _tag: 'Inactive' };
export function activeReview(task: string): ActiveReview { return { _tag: 'Active', task }; }
export function lockedReview(task: string, reviewerId: string): LockedReview { return { _tag: 'Locked', task, reviewerId }; }
export function acceptedReview(): AcceptedReview { return { _tag: 'Accepted' }; }
export function rejectedReview(feedback: string): RejectedReview { return { _tag: 'Rejected', feedback }; }

export function matchReviewState<R>(state: ReviewState, patterns: { readonly Inactive: () => R; readonly Active: (state: ActiveReview) => R; readonly Locked: (state: LockedReview) => R; readonly Accepted: () => R; readonly Rejected: (state: RejectedReview) => R; }): R {
  switch (state._tag) {
    case 'Inactive': return patterns.Inactive();
    case 'Active': return patterns.Active(state);
    case 'Locked': return patterns.Locked(state);
    case 'Accepted': return patterns.Accepted();
    case 'Rejected': return patterns.Rejected(state);
  }
}

export type ActivateCommand = { readonly _tag: 'Activate'; readonly task: string };
export type SubmitCommand = { readonly _tag: 'Submit' };
export type LockCommand = { readonly _tag: 'Lock'; readonly reviewerId: string };
export type UnlockCommand = { readonly _tag: 'Unlock' };
export type AcceptCommand = { readonly _tag: 'Accept' };
export type RejectCommand = { readonly _tag: 'Reject'; readonly feedback: string };
export type ReviewCommand = ActivateCommand | SubmitCommand | LockCommand | UnlockCommand | AcceptCommand | RejectCommand;

export function activateCommand(task: string): ActivateCommand { return { _tag: 'Activate', task }; }
export const submitCommand: SubmitCommand = { _tag: 'Submit' };
export function lockCommand(reviewerId: string): LockCommand { return { _tag: 'Lock', reviewerId }; }
export const unlockCommand: UnlockCommand = { _tag: 'Unlock' };
export const acceptCommand: AcceptCommand = { _tag: 'Accept' };
export function rejectCommand(feedback: string): RejectCommand { return { _tag: 'Reject', feedback }; }

export function matchReviewCommand<R>(command: ReviewCommand, patterns: { readonly Activate: (cmd: ActivateCommand) => R; readonly Submit: () => R; readonly Lock: (cmd: LockCommand) => R; readonly Unlock: () => R; readonly Accept: () => R; readonly Reject: (cmd: RejectCommand) => R; }): R {
  switch (command._tag) {
    case 'Activate': return patterns.Activate(command);
    case 'Submit': return patterns.Submit();
    case 'Lock': return patterns.Lock(command);
    case 'Unlock': return patterns.Unlock();
    case 'Accept': return patterns.Accept();
    case 'Reject': return patterns.Reject(command);
  }
}

export type ActivatedEvent = { readonly _tag: 'Activated'; readonly task: string };
export type SubmittedEvent = { readonly _tag: 'Submitted' };
export type LockAcquiredEvent = { readonly _tag: 'LockAcquired'; readonly reviewerId: string };
export type LockReleasedEvent = { readonly _tag: 'LockReleased' };
export type AcceptedEvent = { readonly _tag: 'Accepted' };
export type RejectedEvent = { readonly _tag: 'Rejected'; readonly feedback: string };
export type ReviewEvent = ActivatedEvent | SubmittedEvent | LockAcquiredEvent | LockReleasedEvent | AcceptedEvent | RejectedEvent;

export function activatedEvent(task: string): ActivatedEvent { return { _tag: 'Activated', task }; }
export const submittedEvent: SubmittedEvent = { _tag: 'Submitted' };
export function lockAcquiredEvent(reviewerId: string): LockAcquiredEvent { return { _tag: 'LockAcquired', reviewerId }; }
export const lockReleasedEvent: LockReleasedEvent = { _tag: 'LockReleased' };
export const acceptedEvent: AcceptedEvent = { _tag: 'Accepted' };
export function rejectedEvent(feedback: string): RejectedEvent { return { _tag: 'Rejected', feedback }; }

export function matchReviewEvent<R>(event: ReviewEvent, patterns: { readonly Activated: (ev: ActivatedEvent) => R; readonly Submitted: () => R; readonly LockAcquired: (ev: LockAcquiredEvent) => R; readonly LockReleased: () => R; readonly Accepted: () => R; readonly Rejected: (ev: RejectedEvent) => R; }): R {
  switch (event._tag) {
    case 'Activated': return patterns.Activated(event);
    case 'Submitted': return patterns.Submitted();
    case 'LockAcquired': return patterns.LockAcquired(event);
    case 'LockReleased': return patterns.LockReleased();
    case 'Accepted': return patterns.Accepted();
    case 'Rejected': return patterns.Rejected(event);
  }
}