import type { ReviewResult } from 'engine/review';
import type { promptWithAbort } from '../../utils/abort-signal';

export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const systemClock: Clock = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface ReviewerLoopDeps {
  promptFn?: typeof promptWithAbort;
  clock?: Clock;
  graceMs?: number;
}

export type PromptRaceResult =
  | { type: 'result'; result: ReviewResult }
  | { type: 'prompt_done' }
  | { type: 'error'; error: unknown };

export const ABORT_SENTINEL = Symbol('abort-sentinel');
