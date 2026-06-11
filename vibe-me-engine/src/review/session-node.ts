import {
  type ReviewState,
  type ReviewCommand,
  inactive,
} from '../types/review.js';
import { transition } from './state.js';

export type Accepted = { readonly _tag: 'Accepted' };
export type Rejected = { readonly _tag: 'Rejected'; readonly feedback: string };
export type Terminated = { readonly _tag: 'Terminated' };
export type ReviewResult = Accepted | Rejected | Terminated;

export const accepted: Accepted = { _tag: 'Accepted' };
export function rejected(feedback: string): Rejected {
  return { _tag: 'Rejected', feedback };
}
export const terminated: Terminated = { _tag: 'Terminated' };

export function matchReviewResult<T>(
  result: ReviewResult,
  onAccepted: () => T,
  onRejected: (feedback: string) => T,
  onTerminated: () => T,
): T {
  switch (result._tag) {
    case 'Accepted': return onAccepted();
    case 'Rejected': return onRejected(result.feedback);
    case 'Terminated': return onTerminated();
  }
}

export interface ReviewSession {
  readonly id: string;
  readonly state: ReviewState;
  readonly createdAt: number;
  readonly originalTask: string | undefined;
  readonly lastFeedback: string | undefined;
  readonly parentId: string | undefined;
  readonly childIds: readonly string[];
}

export function emptySession(id: string, createdAt: number): ReviewSession {
  return { id, state: inactive, createdAt, childIds: [], originalTask: undefined, lastFeedback: undefined, parentId: undefined };
}

export function applyCommand(session: ReviewSession, command: ReviewCommand): ReviewSession {
  const [nextState] = transition(session.state, command);
  if (nextState === session.state) return session;
  return { ...session, state: nextState };
}

export function withTask(session: ReviewSession, task: string): ReviewSession {
  return { ...session, originalTask: task };
}

export function withFeedback(session: ReviewSession, feedback: string): ReviewSession {
  return { ...session, lastFeedback: feedback };
}

export function addChild(session: ReviewSession, childId: string): ReviewSession {
  return { ...session, childIds: [...session.childIds, childId] };
}