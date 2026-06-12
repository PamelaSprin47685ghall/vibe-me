import { describe, expect, mock, test } from "bun:test";
import { createSubmitReviewTool, isPassingReviewReport, type ReviewDeps } from "./submitReview.js";
import type { ReviewStore } from "engine/review";

function createMockReviewDeps() {
  const mockDeactivateReview = mock(() => undefined);
  const mockGetReviewTask = mock(() => "original task");
  const mockIsReviewActive = mock(() => true);
  const mockTryLockReview = mock(() => true);
  const mockUnlockReview = mock(() => undefined);
  const mockDelegateToSubAgent = mock(() => Promise.resolve("PASS"));

  const reviewStore = {
    tryLockReview: mockTryLockReview,
    isReviewActive: mockIsReviewActive,
    getReviewTask: mockGetReviewTask,
    deactivateReview: mockDeactivateReview,
    unlockReview: mockUnlockReview,
    activateReview: mock(() => undefined),
    clearReviewSessions: mock(() => undefined),
    setPendingReview: mock(() => undefined),
    resolvePendingReview: mock(() => false),
    addChild: mock(() => undefined),
    getReviewState: mock(() => undefined),
  } satisfies ReviewStore;

  return {
    mockDeactivateReview,
    mockGetReviewTask,
    mockIsReviewActive,
    mockTryLockReview,
    mockUnlockReview,
    mockDelegateToSubAgent,
    reviewDeps: {
      reviewStore,
      delegateToSubAgent: mockDelegateToSubAgent,
    } satisfies ReviewDeps,
  };
}

describe("isPassingReviewReport", () => {
  test.each([
    ["PASS", true],
    ["PASS. The code looks good.", true],
    ["  PASS  ", true],
    ['"PASS"', true],
    ["FAIL: broken", false],
    ["REJECT: missing tests", false],
    ["DENIED: not acceptable", false],
    ["DO NOT ACCEPT: issues found", false],
    ["PASS, but FAIL later", false],
    ["The code is PASS", true],
    ["", false],
    ["not a review report", false],
    ["PASS\nSome details here", true],
    ["FAIL", false],
    ["PASS and then FAIL in the same report", false],
  ])("isPassingReviewReport(%j) === %s", (input, expected) => {
    expect(isPassingReviewReport(input)).toBe(expected);
  });
});

describe("submit_review", () => {
  test("ends loop when reviewer reports PASS", async () => {
    const { reviewDeps, mockDeactivateReview, mockUnlockReview } = createMockReviewDeps();
    const tool = createSubmitReviewTool({} as never, reviewDeps);

    const result = await tool.execute(
      { workspaceId: "ws1" } as never,
      { report: "done", affectedFiles: ["src/file.ts"] },
    );

    expect(result).toBe("Review passed. Loop mode ended.");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
    expect(mockUnlockReview).toHaveBeenCalledWith("ws1");
  });

  test("keeps loop active when reviewer returns feedback", async () => {
    const { reviewDeps, mockDeactivateReview, mockUnlockReview, mockDelegateToSubAgent } = createMockReviewDeps();
    mockDelegateToSubAgent.mockResolvedValue("Fix the failing branch.");
    const tool = createSubmitReviewTool({} as never, reviewDeps);

    const result = await tool.execute(
      { workspaceId: "ws1" } as never,
      { report: "done", affectedFiles: ["src/file.ts"] },
    );

    expect(result).toBe(
      "Review feedback:\n\nFix the failing branch.\n\nAddress the feedback above. loop mode is still active; fix the issues and call submit_review again.",
    );
    expect(mockDeactivateReview).not.toHaveBeenCalled();
    expect(mockUnlockReview).toHaveBeenCalledWith("ws1");
  });
});