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

  it('strips a bare head count pipe', () => {
    const result = stripHeadTailPipes('echo a | head 10');
    expect(result.script).toBe('echo a');
    expect(result.stripped).toEqual([{ pipe: '| head 10', name: 'head', count: 10 }]);
  });

  it('strips a tail pipe with a leading dash', () => {
    const result = stripHeadTailPipes('echo a | tail -5');
    expect(result.script).toBe('echo a');
    expect(result.stripped).toEqual([{ pipe: '| tail -5', name: 'tail', count: 5 }]);
  });

  it('stops at a semicolon terminator', () => {
    const result = stripHeadTailPipes('echo a | head 2; echo b');
    expect(result.script).toBe('echo a; echo b');
    expect(result.stripped.map((s) => s.name)).toEqual(['head']);
  });

  it('stops at an ampersand terminator', () => {
    const result = stripHeadTailPipes('cmd | tail 3 &');
    expect(result.script).toBe('cmd &');
    expect(result.stripped.map((s) => s.name)).toEqual(['tail']);
  });

  it('stops at a newline terminator', () => {
    const result = stripHeadTailPipes('cmd | head 5\ncmd2');
    expect(result.script).toBe('cmd\ncmd2');
    expect(result.stripped.map((s) => s.name)).toEqual(['head']);
  });

  it('stops at a hash comment terminator', () => {
    const result = stripHeadTailPipes('cmd | head 5 # keep me');
    expect(result.script).toBe('cmd # keep me');
    expect(result.stripped.map((s) => s.name)).toEqual(['head']);
  });

  it('does not strip grep or sort pipes', () => {
    const result = stripHeadTailPipes('cat f | grep -v noise | sort -r');
    expect(result.script).toBe('cat f | grep -v noise | sort -r');
    expect(result.stripped).toEqual([]);
  });

  it('ignores pipes inside double quoted strings', () => {
    const result = stripHeadTailPipes('echo "a | head 5" | tail 2');
    expect(result.script).toBe('echo "a | head 5"');
    expect(result.stripped).toEqual([{ pipe: '| tail 2', name: 'tail', count: 2 }]);
  });

  it('ignores pipes inside single quoted strings', () => {
    const result = stripHeadTailPipes("echo 'a | tail 5' | head 1");
    expect(result.script).toBe("echo 'a | tail 5'");
    expect(result.stripped).toEqual([{ pipe: '| head 1', name: 'head', count: 1 }]);
  });

  it('strips nested head and tail pipes in order', () => {
    const result = stripHeadTailPipes('cat f | head 10 | tail -5');
    expect(result.script).toBe('cat f');
    expect(result.stripped.map((s) => ({ name: s.name, count: s.count }))).toEqual([
      { name: 'head', count: 10 },
      { name: 'tail', count: 5 },
    ]);
  });
});
