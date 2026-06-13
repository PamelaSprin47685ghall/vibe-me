export type ExecutorLanguage = 'shell' | 'python' | 'javascript';

export const EXECUTOR_LANGUAGES: ExecutorLanguage[] = ['shell', 'python', 'javascript'];

export type ExecutorTimeoutType = 'short' | 'long';

export const EXECUTOR_TIMEOUT_MS: Readonly<Record<ExecutorTimeoutType, number>> = {
  short: 1_000,
  long: 10_000,
};

export const EXECUTOR_SUMMARY_THRESHOLD_BYTES = 8_192;

export interface ExecuteOptions {
  program: string;
  language: ExecutorLanguage;
  dependencies?: string[];
  timeoutType: ExecutorTimeoutType;
  cwd?: string;
}

export interface ExecuteSuccess {
  readonly _tag: 'Completed';
  readonly output: string;
}

export interface ExecuteTruncated {
  readonly _tag: 'Truncated';
  readonly output: string;
  readonly timeoutType: ExecutorTimeoutType;
}

export interface ExecuteError {
  readonly _tag: 'Failed';
  readonly output: string;
}

export interface ExecuteMissingExecutable {
  readonly _tag: 'MissingExecutable';
  readonly executable: string;
  readonly output: string;
}

export type ExecuteResult = ExecuteSuccess | ExecuteTruncated | ExecuteError | ExecuteMissingExecutable;

export interface StrippedPipe {
  pipe: string;
  name: string;
  count: number;
}

export interface StripResult {
  script: string;
  stripped: StrippedPipe[];
}
