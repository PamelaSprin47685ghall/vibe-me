export type RunnerLanguage = 'shell' | 'python' | 'javascript';

export const RUNNER_LANGUAGES: RunnerLanguage[] = ['shell', 'python', 'javascript'];

export interface ActiveJob {
  sessionId: string;
  parentSessionId?: string;
  childProcess: import('node:child_process').ChildProcess | null;
  stdoutFile: string;
  writeStream: import('node:fs').WriteStream | null;
  tempPath?: string;
  projectDir?: string;
  abortController: AbortController;
  bytesRead: number;
  status: 'running' | 'completed' | 'aborted';
  startTime: number;
  closePromise: Promise<void>;
  finalOutput: string;
}

export interface ExecuteOptions {
  sessionId: string;
  parentSessionId?: string;
  program: string;
  language: RunnerLanguage;
  dependencies?: string[];
  earlyTimeoutMs?: number;
  cwd?: string;
}

export interface ExecuteResult {
  output: string;
  background: boolean;
  jobId?: string;
  message?: string;
}

export interface WaitOptions {
  sessionId: string;
  ms: number;
}

export interface WaitResult {
  output: string;
  completed: boolean;
  message?: string;
}

export interface StrippedPipe {
  pipe: string;
  name: string;
  count: number;
}

export interface StripResult {
  script: string;
  stripped: StrippedPipe[];
}
