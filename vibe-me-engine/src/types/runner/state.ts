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

export const MAX_OUTPUT_BYTES = 1024 * 1024;

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