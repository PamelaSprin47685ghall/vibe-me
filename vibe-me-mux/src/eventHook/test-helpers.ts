import { mock } from "bun:test";
import type { JobRegistry } from "engine/runner";
import type { EventHookDeps } from "../eventHook.js";

export function createMockDeps() {
  const mockCleanupRegistry = mock<(registry: JobRegistry, id: string) => void>(() => undefined);
  const mockDeactivateReview = mock(() => undefined);
  const mockSuppress = mock(() => undefined);
  const mockShouldNudge = mock(() => "none");
  const mockHasActiveJob = mock(() => false);
  const mockBuildRunnerNudgePrompt = mock(() => "runner-nudge");
  const mockIsReviewActive = mock(() => false);
  const mockClearIteratorScope = mock(() => undefined);

  return {
    mockCleanupRegistry,
    mockDeactivateReview,
    mockSuppress,
    mockShouldNudge,
    mockHasActiveJob,
    mockBuildRunnerNudgePrompt,
    mockIsReviewActive,
    mockClearIteratorScope,
    deps: {
      cleanupRegistry: mockCleanupRegistry,
      globalJobRegistry: new Map<string, never>() as JobRegistry,
      deactivateReview: mockDeactivateReview,
      isReviewActive: mockIsReviewActive,
      clearIteratorScope: mockClearIteratorScope,
      coordinator: { shouldNudge: mockShouldNudge, suppress: mockSuppress },
      hasActiveJob: mockHasActiveJob,
      buildRunnerNudgePrompt: mockBuildRunnerNudgePrompt,
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
