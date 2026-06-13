import type { ExecuteResult } from 'engine/executor';
import { toExecuteOptions } from './options.js';
import type { CreateExecutorToolDeps, ExecutorArgs } from './types.js';

export async function runExecution(
  deps: CreateExecutorToolDeps,
  args: ExecutorArgs,
  directory: string,
  sessionId: string,
): Promise<ExecuteResult> {
  return deps.execute(toExecuteOptions(args, directory), sessionId);
}

export function handleExecutionError(
  err: unknown,
  isAbortError: (err: unknown) => boolean,
): string {
  if (isAbortError(err)) {
    return '(aborted)';
  }
  throw err;
}
