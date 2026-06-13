import { type Result, ok, err } from 'engine';
import type { ExecutorLanguage, ExecutorTimeoutType } from 'engine/executor';
import type { RawExecutorArgs, ValidatedExecutorArgs } from './types.js';

function isExecutorLanguage(value: unknown): value is ExecutorLanguage {
  return value === 'shell' || value === 'python' || value === 'javascript';
}

function isExecutorTimeoutType(value: unknown): value is ExecutorTimeoutType {
  return value === 'short' || value === 'long';
}

export function validateExecutorArgs(args: unknown): Result<ValidatedExecutorArgs, string> {
  const a = args as RawExecutorArgs;
  if (typeof a.program !== 'string') return err("executor: 'program' must be a string");
  if (!isExecutorLanguage(a.language)) {
    return err("executor: 'language' must be one of shell, python, javascript");
  }
  if (!isExecutorTimeoutType(a.timeout_type)) {
    return err("executor: 'timeout_type' must be 'short' or 'long'");
  }
  const dependencies = Array.isArray(a.dependencies)
    ? a.dependencies.filter((dep): dep is string => typeof dep === 'string')
    : undefined;
  return ok({ program: a.program, language: a.language, dependencies, timeoutType: a.timeout_type });
}
