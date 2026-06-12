import { type ReviewResult, matchReviewResult } from './session-node.js';
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
import { lockCommand, type ReviewState } from '../types/review.js';

export type { ReviewResult, Accepted, Rejected, Terminated } from './session-node.js';
export { accepted, rejected, terminated, matchReviewResult } from './session-node.js';

export interface ReviewStore {
  activateReview(sessionID: string, task: string, createdAt?: number): void;
  deactivateReview(sessionID: string): void;
  clearReviewSessions(): void;
  tryLockReview(sessionID: string): boolean;
  unlockReview(sessionID: string): void;
  setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void;
  resolvePendingReview(sessionID: string, result: ReviewResult): boolean;
  getReviewTask(sessionID: string): string | undefined;
  getReviewState(sessionID: string): ReviewState | undefined;
  isReviewActive(sessionID: string): boolean;
  addChild(parentID: string, childID: string): void;
}

export function createReviewStore(): ReviewStore {
  let registry: SessionRegistry = emptyRegistry();
  const effects: SessionEffects = emptyEffects();

  const allDescendantIds = (sessionId: string): string[] => {
    const session = registry.get(sessionId);
    if (!session) return [sessionId];
    return [sessionId, ...session.childIds.flatMap(allDescendantIds)];
  };

  return {
    activateReview(sessionID, task, createdAt = Date.now()) {
      registry = reduce(registry, { type: 'activate', id: sessionID, task, createdAt });
    },
    deactivateReview(sessionID) {
      disposeSessionTree(effects, allDescendantIds(sessionID));
      registry = reduce(registry, { type: 'deactivate', id: sessionID });
    },
    clearReviewSessions() {
      disposeSessionTree(effects, [...effects.pendingResolutions.keys()]);
      registry = emptyRegistry();
    },
    tryLockReview(sessionID) {
      if (!canTransition(registry, sessionID, lockCommand(sessionID))) return false;
      registry = reduce(registry, { type: 'lock', id: sessionID, reviewerId: sessionID });
      return true;
    },
    unlockReview(sessionID) {
      registry = reduce(registry, { type: 'unlock', id: sessionID });
    },
    setPendingReview(sessionID, resolve) {
      effects.pendingResolutions.set(sessionID, resolve);
    },
    resolvePendingReview(sessionID, result) {
      registry = reduce(registry, matchReviewResult<RegistryAction>(result,
        () => ({ type: 'accept', id: sessionID }),
        (feedback) => ({ type: 'reject', id: sessionID, feedback }),
        () => ({ type: 'deactivate', id: sessionID }),
      ));
      return resolvePending(effects, sessionID, result);
    },
    getReviewTask(sessionID) { return taskOf(registry, sessionID); },
    getReviewState(sessionID) { return stateOf(registry, sessionID); },
    isReviewActive(sessionID) { return sessionIsActive(registry, sessionID); },
    addChild(parentID, childID) {
      registry = reduce(registry, { type: 'addChild', parentId: parentID, childId: childID });
    },
  };
}