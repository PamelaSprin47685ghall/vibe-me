import type { JobState } from '../types/runner/state.js';
import { startExecution } from './state.js';

export { MAX_OUTPUT_BYTES } from '../types/runner/state.js';

export interface JobRecord {
  readonly sessionId: string;
  readonly stdoutFile: string;
  readonly projectDir: string | undefined;
  readonly parentSessionId: string | undefined;
  readonly taskId: string | undefined;
  readonly state: JobState;
}

export function emptyJob(
  sessionId: string,
  stdoutFile: string,
  projectDir: string | undefined,
  startTime: number,
  parentSessionId?: string,
): JobRecord {
  return {
    sessionId, stdoutFile, projectDir, parentSessionId,
    taskId: undefined,
    state: startExecution({ sessionId, program: '', language: 'shell' }, startTime),
  };
}

export function jobOutput(state: JobState): string {
  return state._tag === 'Idle' ? '' : state.output;
}