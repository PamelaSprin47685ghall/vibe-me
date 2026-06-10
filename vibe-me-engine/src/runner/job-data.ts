export type JobStatus = 'running' | 'completed' | 'aborted';

export const MAX_OUTPUT_BYTES = 1024 * 1024;

export interface JobRecord {
  readonly sessionId: string;
  readonly stdoutFile: string;
  readonly projectDir: string | undefined;
  readonly parentSessionId: string | undefined;
  readonly startTime: number;
  readonly status: JobStatus;
  readonly bytesRead: number;
  readonly finalOutput: string;
  readonly taskId: string | undefined;
}

export function emptyJob(
  sessionId: string,
  stdoutFile: string,
  projectDir: string | undefined,
  parentSessionId?: string,
): JobRecord {
  return {
    sessionId, stdoutFile, projectDir, parentSessionId,
    startTime: Date.now(),
    status: 'running',
    bytesRead: 0,
    finalOutput: '',
    taskId: undefined,
  };
}

export function appendOutput(record: JobRecord, chunk: string): JobRecord {
  if (record.finalOutput.length >= MAX_OUTPUT_BYTES) return record;
  return { ...record, finalOutput: record.finalOutput + chunk };
}

export function markCompleted(record: JobRecord): JobRecord {
  return { ...record, status: 'completed' };
}

export function markAborted(record: JobRecord): JobRecord {
  return { ...record, status: 'aborted' };
}