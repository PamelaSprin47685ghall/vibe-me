import { describe, expect, it, beforeEach } from 'bun:test';
import {
  type ReviewResult,
  createReviewStore,
} from './session-runtime.js';

describe('Review Session Runtime', () => {
  let store: ReturnType<typeof createReviewStore>;

  beforeEach(() => {
    store = createReviewStore();
  });

  it('enforces single aggregate lifecycle', () => {
    store.activateReview('test-session', 'test task');
    expect(store.tryLockReview('test-session')).toBe(true);
    expect(store.tryLockReview('test-session')).toBe(false);
  });

  it('cascades dispose to children', () => {
    const rootID = 'root';
    const childIDs = Array.from({ length: 100 }, (_, i) => `child-${i}`);

    store.activateReview(rootID, 'root task');
    for (const childID of childIDs) {
      store.activateReview(childID, 'child task');
      store.addChild(rootID, childID);
    }

    const resolvers: ReviewResult[] = [];
    for (const childID of childIDs) {
      store.setPendingReview(childID, (result) => resolvers.push(result));
    }

    store.deactivateReview(rootID);
    expect(resolvers.length).toBe(100);
    expect(resolvers.every(r => r._tag === 'Terminated')).toBe(true);
  });

  it('prevents re-activation of active session', () => {
    store.activateReview('test-session', 'test task');
    store.activateReview('test-session', 'another task');
  });
});