export type NudgeShellState = {
  readonly nudgedSessions: ReadonlySet<string>;
  readonly stoppedSessions: ReadonlySet<string>;
  readonly retryPendingSessions: ReadonlySet<string>;
  readonly sessionAgents: ReadonlyMap<string, string>;
  readonly lastNudgedSession: string | null;
  readonly deliveredCounts: ReadonlyMap<string, number>;
};

export const emptyNudgeShellState: NudgeShellState = {
  nudgedSessions: new Set(),
  stoppedSessions: new Set(),
  retryPendingSessions: new Set(),
  sessionAgents: new Map(),
  lastNudgedSession: null,
  deliveredCounts: new Map(),
};

export function hasStoppedSession(state: NudgeShellState, sessionID: string): boolean {
  return state.stoppedSessions.has(sessionID);
}

export function hasRetryPendingSession(state: NudgeShellState, sessionID: string): boolean {
  return state.retryPendingSessions.has(sessionID);
}

export function hasNudgedSession(state: NudgeShellState, sessionID: string): boolean {
  return state.nudgedSessions.has(sessionID);
}

export function getAgent(state: NudgeShellState, sessionID: string): string | undefined {
  return state.sessionAgents.get(sessionID);
}

export function getDeliveredCount(state: NudgeShellState, sessionID: string): number | undefined {
  return state.deliveredCounts.get(sessionID);
}

export function resumeSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const nudgedSessions = new Set(state.nudgedSessions);
  nudgedSessions.delete(sessionID);
  const retryPendingSessions = new Set(state.retryPendingSessions);
  retryPendingSessions.delete(sessionID);
  const stoppedSessions = new Set(state.stoppedSessions);
  stoppedSessions.delete(sessionID);
  const deliveredCounts = new Map(state.deliveredCounts);
  deliveredCounts.delete(sessionID);
  return {
    ...state,
    nudgedSessions,
    retryPendingSessions,
    stoppedSessions,
    deliveredCounts,
    lastNudgedSession: state.lastNudgedSession === sessionID ? null : state.lastNudgedSession,
  };
}

export function rememberAgent(state: NudgeShellState, sessionID: string, agent: unknown): NudgeShellState {
  if (typeof agent === 'string' && agent) {
    const sessionAgents = new Map(state.sessionAgents);
    sessionAgents.set(sessionID, agent);
    return { ...state, sessionAgents };
  }
  return state;
}

export function stopSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const nudgedSessions = new Set(state.nudgedSessions);
  nudgedSessions.add(sessionID);
  const retryPendingSessions = new Set(state.retryPendingSessions);
  retryPendingSessions.delete(sessionID);
  const stoppedSessions = new Set(state.stoppedSessions);
  stoppedSessions.add(sessionID);
  return {
    ...state,
    nudgedSessions,
    retryPendingSessions,
    stoppedSessions,
    lastNudgedSession: state.lastNudgedSession === sessionID ? null : state.lastNudgedSession,
  };
}

export function clearSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  let next = resumeSession(state, sessionID);
  const sessionAgents = new Map(next.sessionAgents);
  sessionAgents.delete(sessionID);
  const deliveredCounts = new Map(next.deliveredCounts);
  deliveredCounts.delete(sessionID);
  return { ...next, sessionAgents, deliveredCounts };
}

export function setDeliveredCount(state: NudgeShellState, sessionID: string, count: number): NudgeShellState {
  const deliveredCounts = new Map(state.deliveredCounts);
  deliveredCounts.set(sessionID, count);
  return { ...state, deliveredCounts };
}

export function addNudgedSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const nudgedSessions = new Set(state.nudgedSessions);
  nudgedSessions.add(sessionID);
  return { ...state, nudgedSessions };
}

export function deleteNudgedSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const nudgedSessions = new Set(state.nudgedSessions);
  nudgedSessions.delete(sessionID);
  return { ...state, nudgedSessions };
}

export function addRetryPendingSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const retryPendingSessions = new Set(state.retryPendingSessions);
  retryPendingSessions.add(sessionID);
  return { ...state, retryPendingSessions };
}

export function deleteRetryPendingSession(state: NudgeShellState, sessionID: string): NudgeShellState {
  const retryPendingSessions = new Set(state.retryPendingSessions);
  retryPendingSessions.delete(sessionID);
  return { ...state, retryPendingSessions };
}
