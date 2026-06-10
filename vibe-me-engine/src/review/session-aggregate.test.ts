import { describe, expect, it, beforeEach } from 'bun:test';
import {
  activateReview,
  addChild,
  deactivateReview,
  tryAcquireReviewLock,
  clearReviewSessions,
  setPendingReview,
} from './session-runtime.js';

describe('Review Session Runtime', () => {
  beforeEach(clearReviewSessions);

  it('enforces single aggregate lifecycle', () => {
    activateReview('test-session', 'test task');
    expect(tryAcquireReviewLock('test-session')).toBe(true);
    expect(tryAcquireReviewLock('test-session')).toBe(false);
  });

  it('cascades dispose to children', () => {
    const rootID = 'root';
    const childIDs = Array.from({ length: 100 }, (_, i) => `child-${i}`);

    activateReview(rootID, 'root task');
    for (const childID of childIDs) {
      activateReview(childID, 'child task');
      addChild(rootID, childID);
    }

    const resolvers: { terminated?: boolean }[] = [];
    for (const childID of childIDs) {
      setPendingReview(childID, (result) => resolvers.push(result));
    }

    deactivateReview(rootID);
    expect(resolvers.length).toBe(100);
    expect(resolvers.every(r => r.terminated)).toBe(true);
  });

  it('prevents re-activation of active session', () => {
    activateReview('test-session', 'test task');
    activateReview('test-session', 'another task');
  });
});