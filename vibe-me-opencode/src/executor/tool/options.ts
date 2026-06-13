import type { ExecuteResult } from 'engine/executor';
import {
  buildExecutorSummaryPrompt,
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
} from 'engine/executor';
import type { ExecutorArgs } from './types.js';

export function toExecuteOptions(
  args: ExecutorArgs,
  directory: string,
): import('engine/executor').ExecuteOptions {
  return {
    program: args.program,
    language: args.language,
    dependencies: args.dependencies,
    timeoutType: args.timeout_type,
    cwd: directory,
  };
}

export function buildSummaryPrompt(
  args: ExecutorArgs,
  execResult: ExecuteResult,
): string {
  return `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}\n\n${buildExecutorSummaryPrompt(
    {
      program: args.program,
      language: args.language,
      dependencies: args.dependencies,
      timeoutType: args.timeout_type,
    },
    execResult,
  )}`;
}
