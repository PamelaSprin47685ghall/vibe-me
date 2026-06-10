import type { ReviewResult } from './session-node.js';
import {
  type SessionRegistry,
  emptyRegistry,
  reduce,
  sessionIsActive,
  taskOf,
  canTransition,
  stateOf,
} from './session-registry.js';
import {
  type SessionEffects,
  emptyEffects,
  resolvePending,
  disposeSessionTree,
} from './session-effects.js';
import { lockCommand } from '../types/review.js';

let registry: SessionRegistry = emptyRegistry();
let effects: SessionEffects = emptyEffects();

export function activateReview(sessionID: string, task: string): void {
  registry = reduce(registry, { type: 'activate', id: sessionID, task });
}

function allDescendantIds(sessionId: string): string[] {
  const session = registry.get(sessionId);
  if (!session) return [sessionId];
  return [sessionId, ...session.childIds.flatMap(allDescendantIds)];
}

export function deactivateReview(sessionID: string): void {
  disposeSessionTree(effects, allDescendantIds(sessionID));
  registry = reduce(registry, { type: 'deactivate', id: sessionID });
}

export function clearReviewSessions(): void {
  const allIds = [...registry.values()].flatMap(s => [s.id, ...s.childIds]);
  disposeSessionTree(effects, allIds);
  registry = emptyRegistry();
  effects = emptyEffects();
}

export function tryAcquireReviewLock(sessionID: string): boolean {
  return canTransition(registry, sessionID, lockCommand(sessionID)) &&
    (registry = reduce(registry, { type: 'lock', id: sessionID, reviewerId: sessionID }), true);
}

export function tryLockReview(sessionID: string): boolean {
  return tryAcquireReviewLock(sessionID);
}

export function unlockReview(sessionID: string): void {
  registry = reduce(registry, { type: 'unlock', id: sessionID });
}

export function releaseReviewLock(sessionID: string): void {
  registry = reduce(registry, { type: 'complete', id: sessionID, accepted: true });
}

export function setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void {
  effects.pendingResolutions.set(sessionID, resolve);
}

export function resolvePendingReview(sessionID: string, result: ReviewResult): boolean {
  registry = reduce(registry, { type: 'complete', id: sessionID, accepted: result.accepted, feedback: result.feedback });
  return resolvePending(effects, sessionID, result);
}

export function completeReview(sessionID: string, result: ReviewResult): void {
  registry = reduce(registry, { type: 'complete', id: sessionID, accepted: result.accepted, feedback: result.feedback });
}

export function getReviewTask(sessionID: string): string | undefined {
  return taskOf(registry, sessionID);
}

export function getReviewState(sessionID: string) {
  return stateOf(registry, sessionID);
}

export function getLastFeedback(sessionID: string): string | undefined {
  return registry.get(sessionID)?.lastFeedback;
}

export function isReviewActive(sessionID: string): boolean {
  return sessionIsActive(registry, sessionID);
}

export function addChild(parentID: string, childID: string): void {
  registry = reduce(registry, { type: 'addChild', parentId: parentID, childId: childID });
}

export function setLastFeedback(sessionID: string, feedback: string | null): void {
  registry = reduce(registry, { type: 'setFeedback', id: sessionID, feedback });
}