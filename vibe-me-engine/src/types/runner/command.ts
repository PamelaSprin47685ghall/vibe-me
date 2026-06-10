import type { RunnerLanguage } from './language.js';

export type ExecuteCommand = {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
};

export type WaitCommand = {
  readonly sessionId: string;
  readonly ms: number;
};
