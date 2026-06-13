import { describe, expect, test } from 'vitest';
import { createAbortSuppressor } from './abort.js';

describe('createAbortSuppressor', () => {
  test('uses injected clock for suppression windows', () => {
    let now = 100;
    const suppressor = createAbortSuppressor(50, () => now);

    expect(suppressor.isSuppressed()).toBe(false);
    suppressor.suppress();
    expect(suppressor.isSuppressed()).toBe(true);

    now = 151;
    expect(suppressor.isSuppressed()).toBe(false);
  });

  test('restore clears suppression immediately', () => {
    let now = 0;
    const suppressor = createAbortSuppressor(10, () => now);

    suppressor.suppress();
    suppressor.restore();
    expect(suppressor.isSuppressed()).toBe(false);
  });
});
