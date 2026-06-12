import type { RunnerLanguage } from '../../runner/types.js';

export type ExecuteCommand = {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
};