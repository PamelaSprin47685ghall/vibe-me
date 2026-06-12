import { mock } from 'bun:test';
import type { ReviewResult, ReviewStore } from 'engine/review';
import type { Clock } from './reviewer';

export interface PromptCall {
  args: unknown;
  signal?: AbortSignal;
}

export interface PromptController {
  promise: Promise<void>;
  resolve(): void;
  reject(error: unknown): void;
}

export interface FakeClock extends Clock {
  advance(): void;
}

export function createFakeClock(): FakeClock {
  let scheduled: (() => void) | undefined;
  return {
    setTimeout(callback) {
      scheduled = callback;
      return 1;
    },
    clearTimeout() {
      scheduled = undefined;
    },
    advance() {
      const callback = scheduled;
      scheduled = undefined;
      callback?.();
    },
  };
}

export async function tick(clock: FakeClock) {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  clock.advance();
}

export let promptCalls: PromptCall[] = [];
export let promptControllers: PromptController[] = [];
export let pendingResolve: ((result: ReviewResult) => void) | undefined;

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function createPromptController(): PromptController {
  const deferred = createDeferred<void>();
  const controller: PromptController = {
    promise: deferred.promise,
    resolve: deferred.resolve,
    reject: deferred.reject,
  };
  promptControllers.push(controller);
  return controller;
}

export function queuePendingPrompt(): PromptController {
  return createPromptController();
}

export function queueResolvedPrompt(): PromptController {
  const controller = createPromptController();
  controller.resolve();
  return controller;
}

export function queueRejectedPrompt(error: unknown): PromptController {
  const controller = createPromptController();
  controller.reject(error);
  return controller;
}

export async function mockPromptWithAbort(
  _client: unknown,
  args: unknown,
  signal?: AbortSignal,
): Promise<void> {
  promptCalls.push({ args, signal });
  const controller = promptControllers.shift();
  if (!controller) {
    throw new Error('unexpected prompt');
  }
  return controller.promise;
}

export function makeReviewStore() {
  const deactivateReview = mock(() => {});
  const store: ReviewStore = {
    activateReview() {},
    deactivateReview,
    clearReviewSessions() {},
    tryLockReview() {
      return false;
    },
    unlockReview() {},
    setPendingReview(_sessionID, resolve) {
      pendingResolve = resolve;
    },
    resolvePendingReview() {
      return false;
    },
    getReviewTask() {
      return undefined;
    },
    getReviewState() {
      return undefined;
    },
    isReviewActive() {
      return false;
    },
    addChild() {},
  };
  return { store, deactivateReview };
}

export function resetTestState() {
  promptCalls = [];
  promptControllers = [];
  pendingResolve = undefined;
}

export const client = {} as unknown;
export const childID = 'child-1';
export const originalParts = [
  { type: 'text' as const, text: 'initial prompt' },
];
