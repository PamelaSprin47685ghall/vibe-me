import { vi } from 'vitest';
import type { ReviewStore } from "engine/review";
import type { EventHookDeps } from "../eventHook.js";

export function createMockDeps() {
  const mockDeactivateReview = vi.fn(() => undefined);
  const mockSuppress = vi.fn(() => undefined);
  const mockShouldNudge = vi.fn<(
    sessionId: string,
    context: unknown,
    now: number,
  ) => string>(() => "none");
  const mockIsReviewActive = vi.fn(() => false);
  const mockClearIteratorScope = vi.fn(() => undefined);

  const mockReviewStore = {
    activateReview: vi.fn(() => undefined),
    deactivateReview: mockDeactivateReview,
    clearReviewSessions: vi.fn(() => undefined),
    tryLockReview: vi.fn(() => false),
    unlockReview: vi.fn(() => undefined),
    setPendingReview: vi.fn(() => undefined),
    resolvePendingReview: vi.fn(() => false),
    getReviewTask: vi.fn(() => undefined),
    getReviewState: vi.fn(() => undefined),
    isReviewActive: mockIsReviewActive,
    addChild: vi.fn(() => undefined),
  } satisfies ReviewStore;

  return {
    mockDeactivateReview,
    mockSuppress,
    mockShouldNudge,
    mockIsReviewActive,
    mockClearIteratorScope,
    deps: {
      reviewStore: mockReviewStore,
      clearIteratorScope: mockClearIteratorScope,
      coordinator: { shouldNudge: mockShouldNudge, suppress: mockSuppress },
      TODO_NUDGE_PROMPT: "todo-nudge-prompt",
      LOOP_NUDGE_PROMPT: "loop-nudge-prompt",
    } satisfies EventHookDeps,
  };
}

export function makeHelpers() {
  const nudge = vi.fn<(workspaceId: string, message: string) => Promise<boolean>>(() =>
    Promise.resolve(true),
  );
  const getTodos = vi.fn<(workspaceId: string) => Promise<readonly string[]>>(() =>
    Promise.resolve(["pending"]),
  );
  return { helpers: { nudge, getTodos }, nudge, getTodos };
}
