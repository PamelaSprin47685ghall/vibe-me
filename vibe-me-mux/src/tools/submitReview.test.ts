import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockDeactivateReview = mock<(workspaceId: string) => void>(() => undefined);
const mockGetReviewTask = mock<(workspaceId: string) => string | undefined>(() => "original task");
const mockIsReviewActive = mock<(workspaceId: string) => boolean>(() => true);
const mockTryLockReview = mock<(workspaceId: string) => boolean>(() => true);
const mockUnlockReview = mock<(workspaceId: string) => void>(() => undefined);
const mockDelegateToSubAgent = mock<() => Promise<string>>(() => Promise.resolve("PASS"));

void mock.module("engine/review", () => ({
  deactivateReview: mockDeactivateReview,
  getReviewTask: mockGetReviewTask,
  isReviewActive: mockIsReviewActive,
  REVIEW_INSTRUCTIONS: [
    "You are a code reviewer performing a rigorous review of submitted work.",
    "",
    "# Evaluation Criteria",
    "",
    "Based on the original task, change report, and affected files above, read and inspect the actual file contents before making your judgment.",
    "",
    "# Submitting Your Verdict",
    "",
    'submit_review_result({ "feedback": null })          // Accept — pass with no feedback',
    'submit_review_result({ "feedback": "specific..." }) // Reject — provide detailed, actionable feedback',
    "",
    "IMPORTANT: If you accept, feedback MUST be null. Do not write praise or any other text — it will be misinterpreted as rejection feedback.",
    "",
    "You MUST call submit_review_result before finishing. Do not end the conversation without submitting your verdict.",
  ].join("\n"),
  tryLockReview: mockTryLockReview,
  unlockReview: mockUnlockReview,
}));

void mock.module("./delegate.js", () => ({
  delegateToSubAgent: mockDelegateToSubAgent,
}));

import { createSubmitReviewTool, isPassingReviewReport } from "./submitReview.js";

beforeEach(() => {
  mockDeactivateReview.mockReset();
  mockGetReviewTask.mockReset();
  mockIsReviewActive.mockReset();
  mockTryLockReview.mockReset();
  mockUnlockReview.mockReset();
  mockDelegateToSubAgent.mockReset();

  mockGetReviewTask.mockReturnValue("original task");
  mockIsReviewActive.mockReturnValue(true);
  mockTryLockReview.mockReturnValue(true);
  mockDelegateToSubAgent.mockResolvedValue("PASS");
});

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
    const tool = createSubmitReviewTool({} as never);

    const result = await tool.execute(
      { workspaceId: "ws1" } as never,
      { report: "done", affectedFiles: ["src/file.ts"] },
    );

    expect(result).toBe("Review passed. Loop mode ended.");
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
    expect(mockUnlockReview).toHaveBeenCalledWith("ws1");
  });

  test("keeps loop active when reviewer returns feedback", async () => {
    mockDelegateToSubAgent.mockResolvedValue("Fix the failing branch.");
    const tool = createSubmitReviewTool({} as never);

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
