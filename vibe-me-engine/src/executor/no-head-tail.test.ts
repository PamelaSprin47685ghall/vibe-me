import { describe, expect, it } from 'bun:test';
import { stripHeadTailPipes } from './no-head-tail.js';

describe('stripHeadTailPipes', () => {
  it('strips a single tail pipe', () => {
    const result = stripHeadTailPipes('echo a | tail -n 5');
    expect(result.script).toBe('echo a');
    expect(result.stripped).toEqual([{ pipe: '| tail -n 5', name: 'tail', count: 5 }]);
  });

  it('strips head then tail in order', () => {
    const result = stripHeadTailPipes('cat f | head -n 10 | tail -n 3');
    expect(result.script).toBe('cat f');
    expect(result.stripped.map((s) => s.name)).toEqual(['head', 'tail']);
  });

  it('leaves non head/tail pipes alone', () => {
    const result = stripHeadTailPipes('cat f | grep -v noise');
    expect(result.script).toBe('cat f | grep -v noise');
  });
});
