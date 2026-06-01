import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { AddonEvent } from "./types/tool";

const mockGetActiveJobs = mock<() => Map<string, unknown>>(() => new Map());
const mockCleanupJob = mock<(id: string) => void>(() => undefined);
const mockDeactivateReview = mock<(id: string) => void>(() => undefined);
const mockSuppress = mock<() => void>(() => undefined);
const mockCreateAbortSuppressor = mock<
  (ms: number) => { suppress: () => void }
>(() => ({ suppress: mockSuppress }));

void mock.module("engine/runner", () => ({
  getActiveJobs: mockGetActiveJobs,
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
  mockGetActiveJobs.mockReset();
  mockCleanupJob.mockReset();
  mockDeactivateReview.mockReset();
  mockCreateAbortSuppressor.mockReset();
  mockSuppress.mockReset();

  mockGetActiveJobs.mockReturnValue(new Map());
  mockCreateAbortSuppressor.mockReturnValue({ suppress: mockSuppress });
});

describe("createEventHook", () => {
  test("stream-abort cleans up jobs scoped by workspaceId", () => {
    const event: AddonEvent = { type: "stream-abort", workspaceId: "ws1" };
    mockGetActiveJobs.mockReturnValue(
      new Map([["ws1/job1", {}], ["ws2/job2", {}]]),
    );

    const hook = createEventHook();
    void hook(event);

    expect(mockCleanupJob).toHaveBeenCalledTimes(1);
    expect(mockCleanupJob).toHaveBeenCalledWith("ws1/job1");
    expect(mockCleanupJob).not.toHaveBeenCalledWith("ws2/job2");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("stream-abort with no active jobs", () => {
    const event: AddonEvent = { type: "stream-abort", workspaceId: "ws1" };

    const hook = createEventHook();
    void hook(event);

    expect(mockCleanupJob).not.toHaveBeenCalled();
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("error with abort errorType", () => {
    const event: AddonEvent = {
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
