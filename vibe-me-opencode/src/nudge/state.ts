export function createNudgeState() {
  const nudgedSessions = new Set<string>();
  let lastNudgedSession: string | null = null;
  const retryPendingSessions = new Set<string>();
  const stoppedSessions = new Set<string>();
  const sessionAgents = new Map<string, string>();
  const deliveredNudgeMessageCounts = new Map<string, number>();

  function resumeSession(sessionID: string): void {
    nudgedSessions.delete(sessionID);
    retryPendingSessions.delete(sessionID);
    stoppedSessions.delete(sessionID);
    deliveredNudgeMessageCounts.delete(sessionID);
    if (lastNudgedSession === sessionID) lastNudgedSession = null;
  }

  function rememberAgent(sessionID: string, agent: unknown): void {
    if (typeof agent === 'string' && agent) sessionAgents.set(sessionID, agent);
  }

  function stopSession(sessionID: string): void {
    nudgedSessions.add(sessionID);
    retryPendingSessions.delete(sessionID);
    stoppedSessions.add(sessionID);
    if (lastNudgedSession === sessionID) lastNudgedSession = null;
  }

  function clearSession(sessionID: string): void {
    resumeSession(sessionID);
    sessionAgents.delete(sessionID);
    deliveredNudgeMessageCounts.delete(sessionID);
  }

  function getAgent(sessionID: string): string | undefined {
    return sessionAgents.get(sessionID);
  }

  function getDeliveredCount(sessionID: string): number | undefined {
    return deliveredNudgeMessageCounts.get(sessionID);
  }

  function setDeliveredCount(sessionID: string, count: number): void {
    deliveredNudgeMessageCounts.set(sessionID, count);
  }

  function addNudgedSession(sessionID: string): void {
    nudgedSessions.add(sessionID);
  }

  function deleteNudgedSession(sessionID: string): void {
    nudgedSessions.delete(sessionID);
  }

  function hasNudgedSession(sessionID: string): boolean {
    return nudgedSessions.has(sessionID);
  }

  function hasStoppedSession(sessionID: string): boolean {
    return stoppedSessions.has(sessionID);
  }

  function hasRetryPendingSession(sessionID: string): boolean {
    return retryPendingSessions.has(sessionID);
  }

  function addRetryPendingSession(sessionID: string): void {
    retryPendingSessions.add(sessionID);
  }

  function deleteRetryPendingSession(sessionID: string): void {
    retryPendingSessions.delete(sessionID);
  }

  return {
    get lastNudgedSession() { return lastNudgedSession; },
    set lastNudgedSession(val: string | null) { lastNudgedSession = val; },
    resumeSession,
    rememberAgent,
    stopSession,
    clearSession,
    getAgent,
    getDeliveredCount,
    setDeliveredCount,
    addNudgedSession,
    deleteNudgedSession,
    hasNudgedSession,
    hasStoppedSession,
    hasRetryPendingSession,
    addRetryPendingSession,
    deleteRetryPendingSession,
  };
}

export type NudgeState = ReturnType<typeof createNudgeState>;
