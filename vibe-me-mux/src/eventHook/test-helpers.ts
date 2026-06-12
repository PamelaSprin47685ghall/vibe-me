import { mock } from "bun:test";
import type { ReviewStore } from "engine/review";
import type { EventHookDeps } from "../eventHook.js";

export function createMockDeps() {
  const mockDeactivateReview = mock(() => undefined);
  const mockSuppress = mock(() => undefined);
  const mockShouldNudge = mock<(
    sessionId: string,
    context: unknown,
    now: number,
  ) => string>(() => "none");
  const mockIsReviewActive = mock(() => false);
  const mockClearIteratorScope = mock(() => undefined);

  const mockReviewStore = {
    activateReview: mock(() => undefined),
    deactivateReview: mockDeactivateReview,
    clearReviewSessions: mock(() => undefined),
    tryLockReview: mock(() => false),
    unlockReview: mock(() => undefined),
    setPendingReview: mock(() => undefined),
    resolvePendingReview: mock(() => false),
    getReviewTask: mock(() => undefined),
    getReviewState: mock(() => undefined),
    isReviewActive: mockIsReviewActive,
    addChild: mock(() => undefined),
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
  const nudge = mock<(workspaceId: string, message: string) => Promise<boolean>>(() =>
    Promise.resolve(true),
  );
  const getTodos = mock<(workspaceId: string) => Promise<readonly string[]>>(() =>
    Promise.resolve(["pending"]),
  );
  return { helpers: { nudge, getTodos }, nudge, getTodos };
}
