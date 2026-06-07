type ChildAgentRecord = {
  agent: string;
  parentSessionID?: string;
};

const childAgentRecords = new Map<string, ChildAgentRecord>();

export function registerChildAgent(
  sessionID: string,
  agent: string,
  parentSessionID?: string,
): void {
  childAgentRecords.set(sessionID, { agent, parentSessionID });
}

export function lookupChildAgent(sessionID: string): string | undefined {
  return childAgentRecords.get(sessionID)?.agent;
}

export function resolveSubsessionParentID(
  sessionID?: string,
): string | undefined {
  if (sessionID === undefined) {
    return undefined;
  }

  if (!childAgentRecords.has(sessionID)) {
    return sessionID;
  }

  const visitedSessionIDs = new Set<string>();
  let currentSessionID = sessionID;
  let resolvedParentSessionID = sessionID;

  while (!visitedSessionIDs.has(currentSessionID)) {
    visitedSessionIDs.add(currentSessionID);

    const currentRecord = childAgentRecords.get(currentSessionID);
    const parentSessionID = currentRecord?.parentSessionID;

    if (parentSessionID === undefined) {
      return resolvedParentSessionID;
    }

    resolvedParentSessionID = parentSessionID;

    if (!childAgentRecords.has(parentSessionID)) {
      return parentSessionID;
    }

    currentSessionID = parentSessionID;
  }

  return resolvedParentSessionID;
}

export function unregisterChildAgent(sessionID: string): void {
  childAgentRecords.delete(sessionID);
}
