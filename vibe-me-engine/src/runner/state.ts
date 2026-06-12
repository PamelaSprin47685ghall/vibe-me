import type { ExecuteCommand } from '../types/runner/command.js';
import type { ExecuteEvent } from '../types/runner/event.js';
import type { ExecuteResult, WaitResult } from '../types/runner/result.js';
import { completedResult, failedResult, waitCompletedResult, waitAbortedResult, stillRunningResult } from '../types/runner/result.js';
import type { JobState, RunningState } from '../types/runner/state.js';
import { MAX_OUTPUT_BYTES, completedState, abortedState } from '../types/runner/state.js';
import type { Maybe } from '../types/general.js';
import { assertNever, none, some } from '../types/general.js';

export function truncateOutput(output: string, maxBytes: number): string {
  return output.length <= maxBytes ? output : output.slice(0, maxBytes);
}

export function transition(state: JobState, event: ExecuteEvent): JobState {
  switch (state._tag) {
    case 'Idle':
    case 'Completed':
    case 'Aborted':
      return state;
    case 'Running':
      switch (event._tag) {
        case 'Output':
          return { ...state, output: truncateOutput(state.output + event.data, MAX_OUTPUT_BYTES) };
        case 'Error':
          return abortedState(truncateOutput(state.output + event.message, MAX_OUTPUT_BYTES));
        case 'Exit':
          return event.code === null ? abortedState(state.output) : completedState(state.output);
        default:
          return assertNever(event);
      }
    default:
      return assertNever(state);
  }
}

export function startExecution(_cmd: ExecuteCommand, startTime: number): RunningState {
  return { _tag: 'Running', startTime, bytesRead: 0, output: '' };
}

export function createInitialState(): JobState {
  return { _tag: 'Idle' };
}

export function evaluateWait(state: JobState): { readonly result: WaitResult; readonly nextState: JobState } {
  switch (state._tag) {
    case 'Idle':
      return { result: stillRunningResult(''), nextState: state };
    case 'Running': {
      const incremental = state.output.slice(state.bytesRead);
      return { result: stillRunningResult(incremental), nextState: { ...state, bytesRead: state.output.length } };
    }
    case 'Completed':
      return { result: waitCompletedResult(state.output), nextState: state };
    case 'Aborted':
      return { result: waitAbortedResult(state.output), nextState: state };
    default:
      return assertNever(state);
  }
}

export function computeResult(state: JobState): Maybe<ExecuteResult> {
  switch (state._tag) {
    case 'Idle':
    case 'Running':
      return none;
    case 'Completed':
      return some(completedResult(state.output));
    case 'Aborted':
      return some(failedResult(state.output));
    default:
      return assertNever(state);
  }
}

export function shouldContinue(state: JobState, timeoutMs: number, now: number): boolean {
  switch (state._tag) {
    case 'Idle':
    case 'Completed':
    case 'Aborted':
      return false;
    case 'Running':
      return (now - state.startTime) < timeoutMs;
    default:
      return assertNever(state);
  }
}