import { describe, expect, it, beforeEach } from 'bun:test';
import {
  createReviewStore,
  type ReviewResult,
  accepted,
  rejected,
} from './session-runtime.js';

describe('Review Runtime', () => {
  let store: ReturnType<typeof createReviewStore>;

  beforeEach(() => {
    store = createReviewStore();
  });

  describe('state transitions', () => {
    it('starts active after activation', () => {
      store.activateReview('session-1', 'task-1');
      expect(store.isReviewActive('session-1')).toBe(true);
    });

    it('allows lock acquisition from active', () => {
      store.activateReview('session-1', 'task-1');
      expect(store.tryLockReview('session-1')).toBe(true);
      expect(store.tryLockReview('session-1')).toBe(false);
    });

    it('unlock returns to active', () => {
      store.activateReview('session-1', 'task-1');
      store.tryLockReview('session-1');
      store.unlockReview('session-1');
      expect(store.getReviewState('session-1')?._tag).toBe('Active');
    });

    it('rejects lock when not active', () => {
      expect(store.tryLockReview('nonexistent')).toBe(false);
    });
  });

  describe('pending resolution', () => {
    it('resolves pending review', () => {
      let resolved = false;
      let result: ReviewResult | undefined;
      store.activateReview('session-1', 'task-1');
      store.setPendingReview('session-1', (res) => { resolved = true; result = res; });
      const success = store.resolvePendingReview('session-1', rejected('Approved'));
      expect(success).toBe(true);
      expect(resolved).toBe(true);
      expect(result?._tag).toBe('Rejected');
      if (result?._tag === 'Rejected') expect(result.feedback).toBe('Approved');
    });

    it('returns false when no pending review', () => {
      const success = store.resolvePendingReview('nonexistent', rejected('test'));
      expect(success).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('deactivates and removes session', () => {
      store.activateReview('session-1', 'task-1');
      store.deactivateReview('session-1');
      expect(store.isReviewActive('session-1')).toBe(false);
    });

    it('clears all sessions', () => {
      store.activateReview('session-1', 'task-1');
      store.activateReview('session-2', 'task-2');
      store.clearReviewSessions();
      expect(store.isReviewActive('session-1')).toBe(false);
      expect(store.isReviewActive('session-2')).toBe(false);
    });
  });

  describe('query', () => {
    it('stores original task', () => {
      store.activateReview('session-1', 'Refactor auth');
      expect(store.getReviewTask('session-1')).toBe('Refactor auth');
    });
  });
});