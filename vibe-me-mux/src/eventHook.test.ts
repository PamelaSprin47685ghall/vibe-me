import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { PluginEvent, PluginEventHelpers } from "./types/tool.js";

const mockCleanupJob = mock<(id: string) => void>(() => undefined);
const mockDeactivateReview = mock<(id: string) => void>(() => undefined);
const mockSuppress = mock<(id: string) => void>(() => undefined);
const mockShouldNudge = mock<(sessionId: string, context: unknown) => string>(() => "none");
const mockHasActiveJob = mock<() => boolean>(() => false);
const mockGetActiveJobs = mock(() => new Map());
const mockBuildRunnerNudgePrompt = mock<() => string>(() => "runner-nudge");

void mock.module("engine/runner", () => ({
  cleanupJob: mockCleanupJob,
  getActiveJobs: mockGetActiveJobs,
  hasActiveJob: mockHasActiveJob,
  buildRunnerNudgePrompt: mockBuildRunnerNudgePrompt,
}));

void mock.module("engine/review", () => ({
  deactivateReview: mockDeactivateReview,
  isReviewActive: mock(() => false),
}));

void mock.module("engine/util", () => ({
  globalIteratorStore: { clearScope: mock(() => undefined) },
}));

void mock.module("engine/todo", () => ({
  defaultCoordinator: { shouldNudge: mockShouldNudge, suppress: mockSuppress },
  TODO_NUDGE_PROMPT: "todo-nudge-prompt",
  LOOP_NUDGE_PROMPT: "loop-nudge-prompt",
}));

import { createEventHook } from "./eventHook.js";

beforeEach(() => {
  mockCleanupJob.mockReset();
  mockDeactivateReview.mockReset();
  mockSuppress.mockReset();
  mockShouldNudge.mockReset();
  mockHasActiveJob.mockReset();
  mockGetActiveJobs.mockReset();
  mockBuildRunnerNudgePrompt.mockReset();

  mockShouldNudge.mockReturnValue("none");
  mockHasActiveJob.mockReturnValue(false);
  mockGetActiveJobs.mockReturnValue(new Map());
  mockBuildRunnerNudgePrompt.mockReturnValue("runner-nudge");
});

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
    const event: PluginEvent = { type: "stream-abort", workspaceId: "ws1" };
    const hook = createEventHook();
    void hook(event);
    expect(mockCleanupJob).toHaveBeenCalledTimes(1);
    expect(mockCleanupJob).toHaveBeenCalledWith("ws1");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("error with abort errorType", () => {
    const event: PluginEvent = {
      type: "error",
      workspaceId: "err-ws",
      properties: { errorType: "aborted" },
    };
    const hook = createEventHook();
    void hook(event);
    expect(mockSuppress).toHaveBeenCalledWith("err-ws");
  });

  test("stream-end with open todos nudge", async () => {
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [{ type: "text", text: "done" }] },
    };

    const hook = createEventHook();
    await hook(event, helpers);

    expect(getTodos).toHaveBeenCalledWith("ws1");
    expect(mockShouldNudge).toHaveBeenCalledWith("ws1", expect.objectContaining({
      todos: [{ status: "pending" }],
      lastAssistantMessage: "done",
    }));
    expect(nudge).toHaveBeenCalledWith("ws1", "todo-nudge-prompt");
  });

  test("stream-end with queued message stop reason does not nudge", async () => {
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

    const hook = createEventHook();
    await hook(event, helpers);

    expect(getTodos).not.toHaveBeenCalled();
    expect(mockShouldNudge).not.toHaveBeenCalled();
    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with no helpers does not nudge", async () => {
    mockShouldNudge.mockReturnValue("nudge-todo");
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook();
    await hook(event);

    expect(mockShouldNudge).not.toHaveBeenCalled();
  });

  test("stream-end when shouldNudge returns none does not nudge", async () => {
    mockShouldNudge.mockReturnValue("none");
    const { helpers, nudge } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [{ type: "text", text: "all done" }] },
    };

    const hook = createEventHook();
    await hook(event, helpers);

    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with nudge-runner action sends runner prompt", async () => {
    mockHasActiveJob.mockReturnValue(true);
    mockShouldNudge.mockReturnValue("nudge-runner");
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook();
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
    const { helpers, nudge, getTodos } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    mockHasActiveJob.mockReturnValue(true);
    mockShouldNudge.mockReturnValue("nudge-runner");

    const hook = createEventHook();
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
    mockShouldNudge.mockReturnValue("nudge-loop");
    const { helpers, nudge } = makeHelpers();
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook();
    await hook(event, helpers);

    expect(nudge).toHaveBeenCalledWith("ws1", "loop-nudge-prompt");
  });

  test("stream-end extracts last assistant message from text parts", async () => {
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

    const hook = createEventHook();
    await hook(event, helpers);

    expect(mockShouldNudge).toHaveBeenCalledWith("ws1", expect.objectContaining({
      lastAssistantMessage: "first\nsecond",
    }));
  });

  test("stream-end with getTodos failure does not nudge", async () => {
    const { helpers, nudge, getTodos } = makeHelpers();
    getTodos.mockRejectedValueOnce(new Error("read failed"));
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook();
    await hook(event, helpers);

    expect(mockShouldNudge).not.toHaveBeenCalled();
    expect(nudge).not.toHaveBeenCalled();
  });

  test("stream-end with nudge failure does not throw", async () => {
    mockShouldNudge.mockReturnValue("nudge-todo");
    const { helpers, nudge } = makeHelpers();
    nudge.mockRejectedValueOnce(new Error("send failed"));
    const event: PluginEvent = {
      type: "stream-end",
      workspaceId: "ws1",
      properties: { parts: [] },
    };

    const hook = createEventHook();
    await expect(hook(event, helpers)).resolves.toBeUndefined();
  });
});
