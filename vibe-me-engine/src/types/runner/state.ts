export type IdleState = { readonly _tag: 'Idle' };
export type RunningState = {
  readonly _tag: 'Running';
  readonly startTime: number;
  readonly bytesRead: number;
  readonly output: string;
};
export type CompletedState = {
  readonly _tag: 'Completed';
  readonly output: string;
};
export type AbortedState = {
  readonly _tag: 'Aborted';
  readonly output: string;
};
export type JobState = IdleState | RunningState | CompletedState | AbortedState;

export const idleState: IdleState = { _tag: 'Idle' };

export function runningState(
  startTime: number,
  bytesRead: number,
  output: string,
): RunningState {
  return { _tag: 'Running', startTime, bytesRead, output };
}

export function completedState(output: string): CompletedState {
  return { _tag: 'Completed', output };
}

export function abortedState(output: string): AbortedState {
  return { _tag: 'Aborted', output };
}

export function matchJobState<R>(
  state: JobState,
  patterns: {
    readonly Idle: (state: IdleState) => R;
    readonly Running: (state: RunningState) => R;
    readonly Completed: (state: CompletedState) => R;
    readonly Aborted: (state: AbortedState) => R;
  },
): R {
  switch (state._tag) {
    case 'Idle': return patterns.Idle(state);
    case 'Running': return patterns.Running(state);
    case 'Completed': return patterns.Completed(state);
    case 'Aborted': return patterns.Aborted(state);
  }
}
