export type ReviewState = 'Idle' | 'AwaitingSubmission' | 'UnderReview' | 'Completed';

export type ReviewEvent = 'ACTIVATE' | 'ACQUIRE_LOCK' | 'UNLOCK' | 'RELEASE_LOCK' | 'COMPLETE';

export interface ReviewResult { 
  readonly accepted: boolean; 
  readonly feedback?: string; 
  readonly terminated?: boolean;
}

export const STATE_TRANSITIONS: Record<ReviewState, Partial<Record<ReviewEvent, ReviewState>>> = {
  Idle: { ACTIVATE: 'AwaitingSubmission' },
  AwaitingSubmission: { ACQUIRE_LOCK: 'UnderReview', COMPLETE: 'Completed' },
  UnderReview: { UNLOCK: 'AwaitingSubmission', RELEASE_LOCK: 'Completed', COMPLETE: 'Completed' },
  Completed: {},
};
