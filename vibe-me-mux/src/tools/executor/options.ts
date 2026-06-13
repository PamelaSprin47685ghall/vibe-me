import { randomUUID } from 'node:crypto';
import type { ExecuteOptions } from 'engine/executor';
import {
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  buildExecutorSummaryPrompt,
} from 'engine/executor';
import type { ValidatedExecutorArgs } from './types.js';

export function buildExecutorOptions(
  args: ValidatedExecutorArgs,
  cwd: string | undefined,
): ExecuteOptions {
  return {
    program: args.program,
    language: args.language,
    dependencies: args.dependencies,
    timeoutType: args.timeoutType,
    cwd,
  };
}

export function buildSessionId(workspaceId: string): string {
  return `${workspaceId}/${randomUUID()}`;
}

export function buildSummaryPrompt(
  args: ValidatedExecutorArgs,
  execResult: import('engine/executor').ExecuteResult,
): string {
  return `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}

${buildExecutorSummaryPrompt(
    {
      program: args.program,
      language: args.language,
      dependencies: args.dependencies,
      timeoutType: args.timeoutType,
    },
    execResult,
  )}`;
}
