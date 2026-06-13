import { createReviewStore } from 'engine/review';
import { describe, expect, test } from 'vitest';
import { getReviewerConfig } from './index';

describe('reviewSessions state', () => {
  test('starts inactive', () => {
    const reviewStore = createReviewStore();
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
  });

  test('can activate and deactivate', () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'test task', 0);
    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
    reviewStore.deactivateReview('ses-1');
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
  });

  test('stores original task', () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'Refactor the auth module', 0);
    expect(reviewStore.getReviewTask('ses-1')).toBe('Refactor the auth module');
  });

  test('unlock on unknown session does not throw', () => {
    const reviewStore = createReviewStore();
    expect(() => reviewStore.unlockReview('nonexistent')).not.toThrow();
  });
});

describe('getReviewerConfig', () => {
  test('matches expected permission structure', () => {
    const config = getReviewerConfig();
    expect(config.agents?.reviewer?.permission).toEqual({
      read: 'allow',
      bash: 'deny',
      edit: 'deny',
      write: 'deny',
      glob: 'deny',
      grep: 'deny',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      task: 'deny',
    });
  });
});
