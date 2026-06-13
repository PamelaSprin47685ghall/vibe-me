import { describe, expect, it } from 'vitest';
import {
  emptyNudgeShellState,
  hasStoppedSession,
  hasRetryPendingSession,
  hasNudgedSession,
  getAgent,
  getDeliveredCount,
  resumeSession,
  rememberAgent,
  stopSession,
  clearSession,
  setDeliveredCount,
  addNudgedSession,
  deleteNudgedSession,
  addRetryPendingSession,
  deleteRetryPendingSession,
} from './index.js';

const S = 'sess-1';

describe('nudge-shell state machine (pure)', () => {
  it('empty state has no membership and null lastNudgedSession', () => {
    expect(hasStoppedSession(emptyNudgeShellState, S)).toBe(false);
    expect(hasRetryPendingSession(emptyNudgeShellState, S)).toBe(false);
    expect(hasNudgedSession(emptyNudgeShellState, S)).toBe(false);
    expect(getAgent(emptyNudgeShellState, S)).toBeUndefined();
    expect(getDeliveredCount(emptyNudgeShellState, S)).toBeUndefined();
    expect(emptyNudgeShellState.lastNudgedSession).toBeNull();
  });

  it('addNudgedSession / deleteNudgedSession toggle membership immutably', () => {
    const added = addNudgedSession(emptyNudgeShellState, S);
    expect(hasNudgedSession(added, S)).toBe(true);
    expect(hasNudgedSession(emptyNudgeShellState, S)).toBe(false);
    const removed = deleteNudgedSession(added, S);
    expect(hasNudgedSession(removed, S)).toBe(false);
  });

  it('addRetryPendingSession / deleteRetryPendingSession toggle immutably', () => {
    const added = addRetryPendingSession(emptyNudgeShellState, S);
    expect(hasRetryPendingSession(added, S)).toBe(true);
    expect(hasRetryPendingSession(deleteRetryPendingSession(added, S), S)).toBe(false);
  });

  it('stopSession marks nudged+stopped and removes retryPending and lastNudged', () => {
    let s = addRetryPendingSession(emptyNudgeShellState, S);
    s = { ...s, lastNudgedSession: S };
    const stopped = stopSession(s, S);
    expect(hasStoppedSession(stopped, S)).toBe(true);
    expect(hasNudgedSession(stopped, S)).toBe(true);
    expect(hasRetryPendingSession(stopped, S)).toBe(false);
    expect(stopped.lastNudgedSession).toBeNull();
  });

  it('rememberAgent stores only non-empty string agents', () => {
    expect(getAgent(rememberAgent(emptyNudgeShellState, S, 'editor'), S)).toBe('editor');
    expect(getAgent(rememberAgent(emptyNudgeShellState, S, ''), S)).toBeUndefined();
    expect(getAgent(rememberAgent(emptyNudgeShellState, S, 42), S)).toBeUndefined();
    expect(getAgent(rememberAgent(emptyNudgeShellState, S, undefined), S)).toBeUndefined();
  });

  it('setDeliveredCount / getDeliveredCount round-trip', () => {
    expect(getDeliveredCount(setDeliveredCount(emptyNudgeShellState, S, 7), S)).toBe(7);
  });

  it('resumeSession clears nudged/retry/stopped/delivered and lastNudged', () => {
    let s = stopSession(emptyNudgeShellState, S);
    s = addRetryPendingSession(s, S);
    s = setDeliveredCount(s, S, 3);
    s = { ...s, lastNudgedSession: S };
    const resumed = resumeSession(s, S);
    expect(hasNudgedSession(resumed, S)).toBe(false);
    expect(hasStoppedSession(resumed, S)).toBe(false);
    expect(hasRetryPendingSession(resumed, S)).toBe(false);
    expect(getDeliveredCount(resumed, S)).toBeUndefined();
    expect(resumed.lastNudgedSession).toBeNull();
  });

  it('clearSession additionally removes the agent mapping', () => {
    let s = rememberAgent(emptyNudgeShellState, S, 'editor');
    s = setDeliveredCount(s, S, 5);
    const cleared = clearSession(s, S);
    expect(getAgent(cleared, S)).toBeUndefined();
    expect(getDeliveredCount(cleared, S)).toBeUndefined();
  });

  it('does not mutate the input state object', () => {
    const before = JSON.stringify([...emptyNudgeShellState.nudgedSessions]);
    addNudgedSession(emptyNudgeShellState, S);
    expect(JSON.stringify([...emptyNudgeShellState.nudgedSessions])).toBe(before);
  });
});
