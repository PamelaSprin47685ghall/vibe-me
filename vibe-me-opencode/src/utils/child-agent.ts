const map = new Map<string, string>();

export function registerChildAgent(sessionID: string, agent: string): void {
  map.set(sessionID, agent);
}

export function lookupChildAgent(sessionID: string): string | undefined {
  return map.get(sessionID);
}

export function unregisterChildAgent(sessionID: string): void {
  map.delete(sessionID);
}
