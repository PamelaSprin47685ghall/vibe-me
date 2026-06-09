import { afterEach, describe, expect, test } from 'bun:test';
import {
  activateReview,
  clearReviewSessions,
  deactivateReview,
  getReviewTask,
  isReviewActive,
  unlockReview,
} from 'engine/review';
import { getReviewerConfig } from './index';

afterEach(() => {
  clearReviewSessions();
});

describe('reviewSessions state', () => {
  test('starts inactive', () => {
    expect(isReviewActive('ses-1')).toBe(false);
  });

  test('can activate and deactivate', () => {
    activateReview('ses-1', 'test task');
    expect(isReviewActive('ses-1')).toBe(true);
    deactivateReview('ses-1');
    expect(isReviewActive('ses-1')).toBe(false);
  });

  test('stores original task', () => {
    activateReview('ses-1', 'Refactor the auth module');
    expect(getReviewTask('ses-1')).toBe('Refactor the auth module');
  });

  test('unlock on unknown session does not throw', () => {
    expect(() => unlockReview('nonexistent')).not.toThrow();
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
