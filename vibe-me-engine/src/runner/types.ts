export type RunnerLanguage = 'shell' | 'python' | 'javascript';

import type { JobRegistry } from './job-registry.js';

export const RUNNER_LANGUAGES: RunnerLanguage[] = ['shell', 'python', 'javascript'];

export interface ExecuteOptions {
  jobs: JobRegistry;
  sessionId: string;
  parentSessionId?: string;
  program: string;
  language: RunnerLanguage;
  dependencies?: string[];
  earlyTimeoutMs?: number;
  cwd?: string;
}

export type ExecuteResult =
  | { readonly _tag: 'Completed'; readonly output: string }
  | { readonly _tag: 'Backgrounded'; readonly output: string; readonly jobId: string };

export interface WaitOptions {
  jobs: JobRegistry;
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
