import { describe, expect, it } from 'bun:test';
import { transition, startExecution, createInitialState, evaluateWait, computeResult, shouldContinue, truncateOutput } from './state.js';
import { outputEvent, errorEvent, exitEvent } from '../types/runner/event.js';
import { MAX_OUTPUT_BYTES } from '../types/runner/state.js';
import { none, some } from '../types/general.js';

const cmd = { sessionId: 's', program: 'echo', language: 'shell' as const };

describe('createInitialState', () => {
  it('returns Idle state', () => {
    expect(createInitialState()).toEqual({ _tag: 'Idle' });
  });
});

describe('startExecution', () => {
  it('returns Running state with given startTime', () => {
    const state = startExecution(cmd, 1000);
    expect(state).toEqual({ _tag: 'Running', startTime: 1000, bytesRead: 0, output: '' });
  });
});

describe('transition', () => {
  it('Idle state stays Idle on any event', () => {
    const idle = createInitialState();
    expect(transition(idle, outputEvent('x'))).toBe(idle);
    expect(transition(idle, errorEvent('x'))).toBe(idle);
    expect(transition(idle, exitEvent(0))).toBe(idle);
  });

  it('Running + Output accumulates output', () => {
    const r = startExecution(cmd, 0);
    const s1 = transition(r, outputEvent('abc'));
    expect(s1._tag).toBe('Running');
    if (s1._tag === 'Running') expect(s1.output).toBe('abc');
    const s2 = transition(s1, outputEvent('de'));
    if (s2._tag === 'Running') expect(s2.output).toBe('abcde');
  });

  it('Running + Output truncates at MAX_OUTPUT_BYTES', () => {
    const r = startExecution(cmd, 0);
    const s = transition(r, outputEvent('x'.repeat(MAX_OUTPUT_BYTES + 100)));
    if (s._tag === 'Running') expect(s.output.length).toBe(MAX_OUTPUT_BYTES);
  });

  it('Running + Exit{code:0} → Completed preserving output', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('hello'));
    s = transition(s, exitEvent(0));
    expect(s._tag).toBe('Completed');
    if (s._tag === 'Completed') expect(s.output).toBe('hello');
  });

  it('Running + Exit{code:1} → Completed (non-zero is still Completed)', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('out'));
    s = transition(s, exitEvent(1));
    expect(s._tag).toBe('Completed');
  });

  it('Running + Exit{code:null} → Aborted', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, exitEvent(null));
    expect(s._tag).toBe('Aborted');
  });

  it('Running + Error → Aborted with error message appended to output', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('pre'));
    s = transition(s, errorEvent('boom'));
    expect(s._tag).toBe('Aborted');
    if (s._tag === 'Aborted') expect(s.output).toBe('preboom');
  });

  it('Completed is terminal — any event leaves it unchanged', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, exitEvent(0));
    expect(s._tag).toBe('Completed');
    const before = s;
    expect(transition(s, outputEvent('x'))).toBe(before);
    expect(transition(s, errorEvent('x'))).toBe(before);
    expect(transition(s, exitEvent(0))).toBe(before);
  });

  it('Aborted is terminal — any event leaves it unchanged', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, exitEvent(null));
    expect(s._tag).toBe('Aborted');
    const before = s;
    expect(transition(s, outputEvent('x'))).toBe(before);
    expect(transition(s, errorEvent('x'))).toBe(before);
    expect(transition(s, exitEvent(0))).toBe(before);
  });
});

describe('evaluateWait', () => {
  it('Idle → StillRunning with empty output', () => {
    const { result } = evaluateWait(createInitialState());
    expect(result).toEqual({ _tag: 'StillRunning', output: '' });
  });

  it('Running returns incremental output and advances bytesRead', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('hello'));
    const { result, nextState } = evaluateWait(s);
    expect(result).toEqual({ _tag: 'StillRunning', output: 'hello' });
    if (nextState._tag === 'Running') {
      expect(nextState.bytesRead).toBe(5);
      const { result: r2 } = evaluateWait(nextState);
      expect(r2).toEqual({ _tag: 'StillRunning', output: '' });
    }
  });

  it('Completed returns full output', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('done'));
    s = transition(s, exitEvent(0));
    const { result } = evaluateWait(s);
    expect(result).toEqual({ _tag: 'Completed', output: 'done' });
  });

  it('Aborted returns full output with Aborted tag', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('oops'));
    s = transition(s, exitEvent(null));
    const { result } = evaluateWait(s);
    expect(result).toEqual({ _tag: 'Aborted', output: 'oops' });
  });
});

describe('computeResult', () => {
  it('Idle → none', () => {
    expect(computeResult(createInitialState())).toBe(none);
  });

  it('Running → none', () => {
    expect(computeResult(startExecution(cmd, 0))).toBe(none);
  });

  it('Completed → some(CompletedResult)', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('x'));
    s = transition(s, exitEvent(0));
    const m = computeResult(s);
    expect(m._tag).toBe('Some');
    if (m._tag === 'Some') {
      expect(m.value).toEqual({ _tag: 'Completed', output: 'x' });
    }
  });

  it('Aborted → some(FailedResult)', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 0);
    s = transition(s, outputEvent('y'));
    s = transition(s, exitEvent(null));
    const m = computeResult(s);
    expect(m._tag).toBe('Some');
    if (m._tag === 'Some') {
      expect(m.value).toEqual({ _tag: 'Failed', message: 'y' });
    }
  });
});

describe('shouldContinue', () => {
  it('Idle → false', () => {
    expect(shouldContinue(createInitialState(), 5000, 1000)).toBe(false);
  });

  it('Completed → false', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 1000);
    s = transition(s, exitEvent(0));
    expect(shouldContinue(s, 5000, 3000)).toBe(false);
  });

  it('Aborted → false', () => {
    let s: ReturnType<typeof transition> = startExecution(cmd, 1000);
    s = transition(s, exitEvent(null));
    expect(shouldContinue(s, 5000, 3000)).toBe(false);
  });

  it('Running before timeout → true', () => {
    const s = startExecution(cmd, 1000);
    expect(shouldContinue(s, 5000, 3000)).toBe(true);
  });

  it('Running at timeout → false', () => {
    const s = startExecution(cmd, 1000);
    expect(shouldContinue(s, 5000, 7000)).toBe(false);
  });
});

describe('truncateOutput', () => {
  it('short string passes through unchanged', () => {
    expect(truncateOutput('abc', 10)).toBe('abc');
  });

  it('long string is truncated to maxBytes', () => {
    expect(truncateOutput('x'.repeat(200), 100).length).toBe(100);
  });
});