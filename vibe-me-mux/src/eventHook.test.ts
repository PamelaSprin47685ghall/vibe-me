import { describe, expect, test, mock } from "bun:test";
import { createEventHook, type EventHookDeps } from "./eventHook.js";
import type { PluginEvent, PluginEventHelpers } from "./types/tool.js";
import type { JobRegistry } from "engine/runner";

function createMockDeps() {
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

function makeHelpers(): {
  helpers: PluginEventHelpers;
  nudge: ReturnType<typeof mock>;
  getTodos: ReturnType<typeof mock>;
} {
  const nudge = mock<(workspaceId: string, message: string) => Promise<boolean>>(() => Promise.resolve(true));
  const getTodos = mock<(workspaceId: string) => Promise<Array<{ status: string }>>>(() =>
    Promise.resolve([{ status: "pending" }]),
  );
  return { helpers: { nudge, getTodos }, nudge, getTodos };
}

describe("createEventHook", () => {
  test("stream-abort cleans up jobs scoped by workspaceId", () => {
    const { deps, mockCleanupRegistry, mockDeactivateReview } = createMockDeps();
    const event: PluginEvent = { type: "stream-abort", workspaceId: "ws1" };
    const hook = createEventHook(deps);
    void hook(event);
    expect(mockCleanupRegistry).toHaveBeenCalledTimes(1);
    expect(mockCleanupRegistry).toHaveBeenCalledWith(expect.any(Map), "ws1");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("error with abort errorType", () => {
    const { deps, mockSuppress } = createMockDeps();
    const event: PluginEvent = {
      type: "error",
      workspaceId: "err-ws",
      properties: { errorType: "aborted" },
    };
    const hook = createEventHook(deps);
    void hook(event);
    expect(mockSuppress).toHaveBeenCalledWith("err-ws");
  });

  test("stream-end with open todos nudge", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [{ type: "text", text: "done" }] },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(getTodos).toHaveBeenCalledWith("ws1");
    expect(mockShouldNudge).toHaveBeenCalledWith("ws1", expect.objectContaining({
      todos: [{ status: "pending" }],
      lastAssistantMessage: "done",
    }));
    expect(nudge).toHaveBeenCalledWith("ws1", "todo-nudge-prompt");
  });

  test("stream-end with queued message stop reason does not nudge", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: {
        parts: [{ type: "text", text: "done" }],
        metadata: { muxStopReason: "queued-message" },
      },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(getTodos).not.toHaveBeenCalled();
    expect(mockShouldNudge).not.toHaveBeenCalled();
    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with no helpers does not nudge", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-todo");
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook(deps);
    await hook(event);

    expect(mockShouldNudge).not.toHaveBeenCalled();
  });

  test("stream-end when shouldNudge returns none does not nudge", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("none");
    const { helpers, nudge } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [{ type: "text", text: "all done" }] },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with nudge-runner action sends runner prompt", async () => {
    const { deps, mockHasActiveJob, mockShouldNudge } = createMockDeps();
    mockHasActiveJob.mockReturnValue(true);
    mockShouldNudge.mockReturnValue("nudge-runner");
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(getTodos).not.toHaveBeenCalled();
    expect(mockShouldNudge).toHaveBeenCalledWith("ws1", expect.objectContaining({
      todos: [],
      hasActiveRunner: true,
      isLoopActive: false,
    }));
    expect(nudge).toHaveBeenCalledWith("ws1", "runner-nudge");
  });

  test("stream-end nudges runner once per active streak and resets after cleanup", async () => {
    const { deps, mockHasActiveJob, mockShouldNudge } = createMockDeps();
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    mockHasActiveJob.mockReturnValue(true);
    mockShouldNudge.mockReturnValue("nudge-runner");

    const hook = createEventHook(deps);
    await hook(event, helpers);
    await hook(event, helpers);

    expect(nudge).toHaveBeenCalledTimes(1);
    expect(nudge).toHaveBeenCalledWith("ws1", "runner-nudge");

    mockHasActiveJob.mockReturnValue(false);
    mockShouldNudge.mockReturnValue("none");

    await hook(event, helpers);

    expect(getTodos).toHaveBeenCalledTimes(1);

    mockHasActiveJob.mockReturnValue(true);
    mockShouldNudge.mockReturnValue("nudge-runner");

    await hook(event, helpers);

    expect(nudge).toHaveBeenCalledTimes(2);
  });

  test("stream-end with nudge-loop action sends loop prompt", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-loop");
    const { helpers, nudge } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(nudge).toHaveBeenCalledWith("ws1", "loop-nudge-prompt");
  });

  test("stream-end extracts last assistant message from text parts", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: {
        parts: [
          { type: "reasoning", text: "thinking..." },
          { type: "text", text: "first" },
          { type: "dynamic-tool", toolName: "editor" },
          { type: "text", text: "second" },
        ],
      },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(mockShouldNudge).toHaveBeenCalledWith("ws1", expect.objectContaining({
      lastAssistantMessage: "first\nsecond",
    }));
  });

  test("stream-end with getTodos failure does not nudge", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    const { helpers, nudge, getTodos } = makeHelpers();
    getTodos.mockRejectedValueOnce(new Error("read failed"));
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook(deps);
    await hook(event, helpers);

    expect(mockShouldNudge).not.toHaveBeenCalled();
    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with nudge failure does not throw", async () => {
    const { deps, mockShouldNudge } = createMockDeps();
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers, nudge } = makeHelpers();
    nudge.mockRejectedValueOnce(new Error("send failed"));
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook(deps);
    await expect(hook(event, helpers)).resolves.toBeUndefined();
  });
});
