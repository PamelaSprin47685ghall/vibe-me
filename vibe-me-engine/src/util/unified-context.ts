export interface UnifiedContext {
  sessionID: string;
  directory: string;
  abortSignal?: AbortSignal;
  parentSessionID?: string;
}

export function resolveUnifiedContext(raw: unknown): UnifiedContext {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid context: must be an object');
  }

  const ctx = raw as Record<string, unknown>;
  
  const sessionID = (
    ctx.sessionID || 
    ctx.sessionId || 
    ctx.session_id || 
    ctx.sessionId
  ) as string;
  
  const directory = (
    ctx.directory || 
    ctx.cwd || 
    ctx.workspaceDir || 
    ctx.workspace_dir ||
    ctx.workingDirectory
  ) as string;

  if (!sessionID) {
    throw new Error('Missing required context field: sessionID');
  }
  
  if (!directory) {
    throw new Error('Missing required context field: directory');
  }

  return {
    sessionID,
    directory,
    abortSignal: ctx.abortSignal as AbortSignal | undefined,
    parentSessionID: (
      ctx.parentSessionID || 
      ctx.parentSessionId || 
      ctx.parent_session_id
    ) as string | undefined,
  };
}

export function createUnifiedContext(
  sessionID: string,
  directory: string,
  options?: {
    abortSignal?: AbortSignal;
    parentSessionID?: string;
  }
): UnifiedContext {
  return {
    sessionID,
    directory,
    abortSignal: options?.abortSignal,
    parentSessionID: options?.parentSessionID,
  };
}
