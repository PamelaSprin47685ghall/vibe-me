import {
  type ReviewState,
  type ReviewCommand,
  inactive,
} from '../types/review.js';
import { transition } from './state.js';

export interface ReviewResult {
  readonly accepted: boolean;
  readonly feedback?: string;
  readonly terminated?: boolean;
}

export interface ReviewSession {
  readonly id: string;
  readonly state: ReviewState;
  readonly createdAt: number;
  readonly originalTask?: string;
  readonly lastFeedback?: string;
  readonly parentId?: string;
  readonly childIds: readonly string[];
}

export function emptySession(id: string): ReviewSession {
  return { id, state: inactive, createdAt: Date.now(), childIds: [] };
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