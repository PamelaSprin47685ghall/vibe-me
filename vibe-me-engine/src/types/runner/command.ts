import type { RunnerLanguage } from './language.js';

export type ExecuteCommand = {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
};

export function createExecuteCommand(params: {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
}): ExecuteCommand {
  return { ...params };
}

export type WaitCommand = {
  readonly sessionId: string;
  readonly ms: number;
};

export function createWaitCommand(params: {
  readonly sessionId: string;
  readonly ms: number;
}): WaitCommand {
  return { ...params };
}
