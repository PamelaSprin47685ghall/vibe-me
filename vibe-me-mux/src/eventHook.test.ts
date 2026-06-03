import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { PluginEvent } from "./types/tool";

const mockCleanupJob = mock<(id: string) => void>(() => undefined);
const mockDeactivateReview = mock<(id: string) => void>(() => undefined);
const mockSuppress = mock<() => void>(() => undefined);
const mockCreateAbortSuppressor = mock<
  (ms: number) => { suppress: () => void }
>(() => ({ suppress: mockSuppress }));

void mock.module("engine/runner", () => ({
  cleanupJob: mockCleanupJob,
}));

void mock.module("engine/review", () => ({
  deactivateReview: mockDeactivateReview,
}));

void mock.module("engine/util", () => ({
  createAbortSuppressor: mockCreateAbortSuppressor,
}));

// mock.module is hoisted by bun — the mock is active before static imports resolve.
import { createEventHook } from "./eventHook";

beforeEach(() => {
  mockCleanupJob.mockReset();
  mockDeactivateReview.mockReset();
  mockCreateAbortSuppressor.mockReset();
  mockSuppress.mockReset();

  mockCreateAbortSuppressor.mockReturnValue({ suppress: mockSuppress });
});

describe("createEventHook", () => {
  test("stream-abort cleans up jobs scoped by workspaceId", () => {
    const event: PluginEvent = { type: "stream-abort", workspaceId: "ws1" };

    const hook = createEventHook();
    void hook(event);

    expect(mockCleanupJob).toHaveBeenCalledTimes(1);
    expect(mockCleanupJob).toHaveBeenCalledWith("ws1");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("stream-abort with no active jobs", () => {
    const event: PluginEvent = { type: "stream-abort", workspaceId: "ws1" };

    const hook = createEventHook();
    void hook(event);

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

    expect(mockCreateAbortSuppressor).toHaveBeenCalledWith(30_000);
    expect(mockSuppress).toHaveBeenCalled();
  });
});
