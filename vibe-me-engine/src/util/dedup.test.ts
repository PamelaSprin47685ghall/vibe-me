import { describe, expect, test } from 'bun:test';
import { createTextOutputDeduper, DEDUP_MARKER } from './dedup.js';

describe('createTextOutputDeduper', () => {
  test('keeps the first output', () => {
    const dedupeOutput = createTextOutputDeduper();
    const output = 'first output';

    expect(dedupeOutput(output)).toBe(output);
  });

  test('replaces output that contains a previous long output', () => {
    const dedupeOutput = createTextOutputDeduper();
    const previousOutput = `${'line of stable content\n'.repeat(8)}`;

    dedupeOutput(previousOutput);

    expect(dedupeOutput(`${previousOutput}${'new content\n'.repeat(8)}`)).toBe(
      DEDUP_MARKER,
    );
  });

  test('keeps exact duplicates', () => {
    const dedupeOutput = createTextOutputDeduper();
    const output = 'same output';

    dedupeOutput(output);

    expect(dedupeOutput(output)).toBe(output);
  });

  test('keeps short increments that do not save the marker cost', () => {
    const dedupeOutput = createTextOutputDeduper();
    const previousOutput = `${'stable content\n'.repeat(8)}`;
    const output = `${previousOutput}ok`;

    dedupeOutput(previousOutput);

    expect(dedupeOutput(output)).toBe(output);
  });
});
