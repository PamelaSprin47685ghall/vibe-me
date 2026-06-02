import { describe, expect, it, beforeEach } from 'bun:test';
import {
  activateReview,
  deactivateReview,
  isReviewActive,
  tryAcquireReviewLock,
  releaseReviewLock,
  setPendingReview,
  resolvePendingReview,
  clearReviewSessions,
  type ReviewResult,
} from './session-unified.js';

describe('Review State Machine - Atomic Transitions', () => {
  beforeEach(() => {
    clearReviewSessions();
  });

  describe('state transitions', () => {
    it('starts in AwaitingSubmission after activation', () => {
      activateReview('session-1', 'task-1');
      expect(isReviewActive('session-1')).toBe(true);
    });

    it('allows lock acquisition only from AwaitingSubmission', () => {
      activateReview('session-1', 'task-1');
      expect(tryAcquireReviewLock('session-1')).toBe(true);
      expect(tryAcquireReviewLock('session-1')).toBe(false);
    });

    it('transitions to Completed after release', () => {
      activateReview('session-1', 'task-1');
      tryAcquireReviewLock('session-1');
      releaseReviewLock('session-1');
      expect(isReviewActive('session-1')).toBe(false);
    });

    it('rejects lock acquisition when not active', () => {
      expect(tryAcquireReviewLock('nonexistent')).toBe(false);
    });
  });

  describe('pending resolution', () => {
    it('resolves pending review', async () => {
      let resolved = false;
      let result: ReviewResult | undefined;

      setPendingReview('session-1', (res) => {
        resolved = true;
        result = res;
      });

      const success = resolvePendingReview('session-1', { accepted: true, feedback: 'Approved' });
      expect(success).toBe(true);
      expect(resolved).toBe(true);
      expect(result?.feedback).toBe('Approved');
    });

    it('returns false when no pending review exists', () => {
      const success = resolvePendingReview('nonexistent', { feedback: 'test' });
      expect(success).toBe(false);
    });

    it('single-consume semantics for resolution', () => {
      let callCount = 0;
      setPendingReview('session-1', () => { callCount++; });

      resolvePendingReview('session-1', { feedback: 'test' });
      resolvePendingReview('session-1', { feedback: 'test' });

      expect(callCount).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('deactivates and removes session', () => {
      activateReview('session-1', 'task-1');
      deactivateReview('session-1');
      expect(isReviewActive('session-1')).toBe(false);
    });

    it('clears all sessions', () => {
      activateReview('session-1', 'task-1');
      activateReview('session-2', 'task-2');

      clearReviewSessions();

      expect(isReviewActive('session-1')).toBe(false);
      expect(isReviewActive('session-2')).toBe(false);
    });

    it('terminates pending resolvers on clear', () => {
      let terminated = false;
      setPendingReview('session-1', (res) => {
        if (res.terminated) terminated = true;
      });

      clearReviewSessions();
      expect(terminated).toBe(true);
    });
  });

  describe('lock exclusivity', () => {
    it('prevents concurrent lock acquisition', () => {
      activateReview('session-1', 'task-1');
      
      const lock1 = tryAcquireReviewLock('session-1');
      const lock2 = tryAcquireReviewLock('session-1');

      expect(lock1).toBe(true);
      expect(lock2).toBe(false);
    });
  });
});
