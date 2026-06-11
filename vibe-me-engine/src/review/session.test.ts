import { describe, expect, it, beforeEach } from 'bun:test';
import {
  activateReview,
  deactivateReview,
  isReviewActive,
  tryAcquireReviewLock,
  unlockReview,
  setPendingReview,
  resolvePendingReview,
  clearReviewSessions,
  getReviewTask,
  getReviewState,
  type ReviewResult,
  accepted,
  rejected,
} from './session-runtime.js';

describe('Review Runtime', () => {
  beforeEach(clearReviewSessions);

  describe('state transitions', () => {
    it('starts active after activation', () => {
      activateReview('session-1', 'task-1');
      expect(isReviewActive('session-1')).toBe(true);
    });

    it('allows lock acquisition from active', () => {
      activateReview('session-1', 'task-1');
      expect(tryAcquireReviewLock('session-1')).toBe(true);
      expect(tryAcquireReviewLock('session-1')).toBe(false);
    });

    it('unlock returns to active', () => {
      activateReview('session-1', 'task-1');
      tryAcquireReviewLock('session-1');
      unlockReview('session-1');
      expect(getReviewState('session-1')?._tag).toBe('Active');
    });

    it('rejects lock when not active', () => {
      expect(tryAcquireReviewLock('nonexistent')).toBe(false);
    });
  });

  describe('pending resolution', () => {
    it('resolves pending review', () => {
      let resolved = false;
      let result: ReviewResult | undefined;
      activateReview('session-1', 'task-1');
      setPendingReview('session-1', (res) => { resolved = true; result = res; });
      const success = resolvePendingReview('session-1', rejected('Approved'));
      expect(success).toBe(true);
      expect(resolved).toBe(true);
      expect(result?._tag).toBe('Rejected');
      if (result?._tag === 'Rejected') expect(result.feedback).toBe('Approved');
    });

    it('returns false when no pending review', () => {
      const success = resolvePendingReview('nonexistent', rejected('test'));
      expect(success).toBe(false);
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
  });

  describe('query', () => {
    it('stores original task', () => {
      activateReview('session-1', 'Refactor auth');
      expect(getReviewTask('session-1')).toBe('Refactor auth');
    });
  });
});