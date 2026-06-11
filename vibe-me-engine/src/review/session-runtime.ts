import { type ReviewResult, matchReviewResult } from './session-node.js';

export type { ReviewResult, Accepted, Rejected, Terminated } from './session-node.js';
export { accepted, rejected, terminated, matchReviewResult } from './session-node.js';
import {
  type SessionRegistry,
  type RegistryAction,
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

export function activateReview(sessionID: string, task: string, createdAt: number = Date.now()): void {
  registry = reduce(registry, { type: 'activate', id: sessionID, task, createdAt });
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

export function setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void {
  effects.pendingResolutions.set(sessionID, resolve);
}

export function resolvePendingReview(sessionID: string, result: ReviewResult): boolean {
  const action = matchReviewResult<RegistryAction>(result,
    () => ({ type: 'accept', id: sessionID }),
    (feedback) => ({ type: 'reject', id: sessionID, feedback }),
    () => ({ type: 'deactivate', id: sessionID }),
  );
  registry = reduce(registry, action);
  return resolvePending(effects, sessionID, result);
}

export function getReviewTask(sessionID: string): string | undefined {
  return taskOf(registry, sessionID);
}

export function getReviewState(sessionID: string) {
  return stateOf(registry, sessionID);
}

export function isReviewActive(sessionID: string): boolean {
  return sessionIsActive(registry, sessionID);
}

export function addChild(parentID: string, childID: string): void {
  registry = reduce(registry, { type: 'addChild', parentId: parentID, childId: childID });
}