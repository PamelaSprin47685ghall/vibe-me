import { Result, ok, err } from '../general.js';

export type Running = { readonly _tag: 'Running' };
export type Completed = { readonly _tag: 'Completed' };
export type Aborted = { readonly _tag: 'Aborted' };
export type JobStatus = Running | Completed | Aborted;

export const running: Running = { _tag: 'Running' };
export const completed: Completed = { _tag: 'Completed' };
export const aborted: Aborted = { _tag: 'Aborted' };

export function jobStatusFromString(value: string): Result<JobStatus, string> {
  switch (value) {
    case 'running': return ok(running);
    case 'completed': return ok(completed);
    case 'aborted': return ok(aborted);
    default: return err(`Invalid JobStatus: "${value}"`);
  }
}

export function jobStatusToString(status: JobStatus): string {
  switch (status._tag) {
    case 'Running': return 'running';
    case 'Completed': return 'completed';
    case 'Aborted': return 'aborted';
  }
}

export function matchJobStatus<R>(
  status: JobStatus,
  patterns: {
    readonly Running: (value: Running) => R;
    readonly Completed: (value: Completed) => R;
    readonly Aborted: (value: Aborted) => R;
  },
): R {
  switch (status._tag) {
    case 'Running': return patterns.Running(status);
    case 'Completed': return patterns.Completed(status);
    case 'Aborted': return patterns.Aborted(status);
  }
}
