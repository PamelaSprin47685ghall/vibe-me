import type {
  ExecuteCommand,
  ExecuteEvent,
  ExecuteResult,
  JobState,
  RunningState,
  WaitCommand,
  WaitResult,
} from '../types/runner.js';
import type { Maybe } from '../types/general.js';
import {
  completedResult,
  failedResult,
} from '../types/runner.js';
import { none, some } from '../types/general.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compile-time exhaustiveness check. */
function assertNever(_: never): never {
  throw new Error('Unreachable state');
}

// ---------------------------------------------------------------------------
// State machine: pure transition
// ---------------------------------------------------------------------------

/**
 * Transition the runner state machine by one event.
 * Returns the current state unchanged for invalid event/state combinations.
 */
export function transition(state: JobState, event: ExecuteEvent): JobState {
  switch (state._tag) {
    case 'Idle': {
      switch (event._tag) {
        case 'Output':
        case 'Error':
        case 'Exit':
        case 'Timeout':
          return state;
        default:
          return assertNever(event);
      }
    }

    case 'Running': {
      switch (event._tag) {
        case 'Output':
          return {
            ...state,
            output: state.output + event.data,
            bytesRead: state.bytesRead + event.data.length,
          };
        case 'Error':
          return {
            ...state,
            output: state.output + event.message,
            bytesRead: state.bytesRead + event.message.length,
          };
        case 'Exit':
          return event.code === 0
            ? { _tag: 'Completed', output: state.output }
            : { _tag: 'Aborted', output: state.output };
        case 'Timeout':
          return { _tag: 'Aborted', output: state.output };
        default:
          return assertNever(event);
      }
    }

    case 'Completed':
    case 'Aborted':
      return state;

    default:
      return assertNever(state);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: ExecuteCommand
// ---------------------------------------------------------------------------

/** Create the initial Running state from an ExecuteCommand. */
export function startExecution(
  cmd: ExecuteCommand,
  startTime: number,
): RunningState {
  return {
    _tag: 'Running',
    startTime,
    bytesRead: 0,
    output: '',
  };
}

// ---------------------------------------------------------------------------
// Lifecycle: WaitCommand
// ---------------------------------------------------------------------------

/** Check whether the given state satisfies a WaitCommand. */
export function evaluateWait(
  state: JobState,
  cmd: WaitCommand,
  elapsedMs: number,
): WaitResult {
  switch (state._tag) {
    case 'Completed':
      return { _tag: 'Completed', output: state.output };
    case 'Aborted':
      return { _tag: 'StillRunning', output: state.output };
    case 'Idle':
      return { _tag: 'StillRunning', output: '' };
    case 'Running':
      if (elapsedMs >= cmd.ms) {
        return { _tag: 'TimedOut' };
      }
      return { _tag: 'StillRunning', output: state.output };
    default:
      return assertNever(state);
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createInitialState(): JobState {
  return { _tag: 'Idle' };
}

// ---------------------------------------------------------------------------
// Result extraction
// ---------------------------------------------------------------------------

/** Extract a result from a terminal state. Returns `none` if not terminal. */
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

// ---------------------------------------------------------------------------
// Timeout check (pure — caller provides the clock)
// ---------------------------------------------------------------------------

/** Returns `false` when the job should stop (idle, terminal, or timed out). */
export function shouldContinue(
  state: JobState,
  timeoutMs: number,
  now: number,
): boolean {
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

// ---------------------------------------------------------------------------
// Output truncation
// ---------------------------------------------------------------------------

/** Keep the first `maxBytes` characters of the output. */
export function truncateOutput(output: string, maxBytes: number): string {
  if (output.length <= maxBytes) return output;
  return output.slice(0, maxBytes);
}
