export function selectNudgePrompt(
  action: string,
  prompts: { todo: string; loop: string; runner: () => string },
): string | null {
  switch (action) {
    case "nudge-todo":
      return prompts.todo;
    case "nudge-loop":
      return prompts.loop;
    case "nudge-runner":
      return prompts.runner();
    default:
      return null;
  }
}

export interface StreamEndState {
  runnerNudgedWorkspaces: Set<string>;
  stoppedWorkspaces: Set<string>;
  retryPendingWorkspaces: Set<string>;
  deliveredCounts: Map<string, number>;
  lastNudgeSignature: Map<string, string>;
}

export function createStreamEndState(): StreamEndState {
  return {
    runnerNudgedWorkspaces: new Set<string>(),
    stoppedWorkspaces: new Set<string>(),
    retryPendingWorkspaces: new Set<string>(),
    deliveredCounts: new Map<string, number>(),
    lastNudgeSignature: new Map<string, string>(),
  };
}
