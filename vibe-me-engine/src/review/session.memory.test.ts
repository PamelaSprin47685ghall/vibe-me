import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
  type ReviewResult,
  createReviewStore,
} from './session-runtime.js';

describe('Review Session Memory Leak Prevention', () => {
  let store: ReturnType<typeof createReviewStore>;

  beforeEach(() => {
    store = createReviewStore();
  });
  afterEach(() => {
    store.clearReviewSessions();
  });

  it('clears resolver references on parent deactivation', () => {
    const parentID = 'parent';
    const childrenIDs: string[] = [];

    store.activateReview(parentID, 'parent task');
    for (let i = 0; i < 100; i++) {
      const childID = `child-${i}`;
      childrenIDs.push(childID);
      store.activateReview(childID, `child task ${i}`);
      store.addChild(parentID, childID);
    }

    const resolversCalled: ReviewResult[] = [];
    for (const childID of childrenIDs) {
      store.setPendingReview(childID, (result) => resolversCalled.push(result));
    }

    store.deactivateReview(parentID);
    expect(resolversCalled.length).toBe(100);
    for (const result of resolversCalled) expect(result._tag).toBe('Terminated');
  });

  it('handles deep child hierarchies', () => {
    const depth = 1000;
    const sessionIDs: string[] = [];

    for (let i = 0; i < depth; i++) {
      const sessionID = `session-${i}`;
      sessionIDs.push(sessionID);
      store.activateReview(sessionID, `task ${i}`);
      if (i > 0) store.addChild(sessionIDs[i - 1]!, sessionID);
    }

    const resolversCalled: unknown[] = [];
    for (let i = 1; i < depth; i++) {
      store.setPendingReview(sessionIDs[i]!, () => resolversCalled.push(null));
    }

    store.deactivateReview(sessionIDs[0]!);
    expect(resolversCalled.length).toBe(depth - 1);
  });

  it('cleans up on rapid create-destroy cycles', () => {
    for (let i = 0; i < 1000; i++) {
      const sessionID = `session-${i}`;
      store.activateReview(sessionID, `task ${i}`);
      store.setPendingReview(sessionID, () => {});
      store.deactivateReview(sessionID);
    }
    store.clearReviewSessions();
  });
});