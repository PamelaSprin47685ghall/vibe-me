import { describe, expect, vi, test } from 'vitest';
import type { ReviewStore } from "engine/review";
import {
  createLoopReviewCommand,
  type LoopReviewDeps,
} from "./loop-review.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { DelegateOptions } from "../tools/delegate.js";

function createFakeReviewStore(overrides: Partial<ReviewStore> = {}): ReviewStore {
  return {
    activateReview: vi.fn(() => undefined),
    deactivateReview: vi.fn(() => undefined),
    clearReviewSessions: vi.fn(() => undefined),
    tryLockReview: vi.fn(() => true),
    unlockReview: vi.fn(() => undefined),
    setPendingReview: vi.fn(() => undefined),
    resolvePendingReview: vi.fn(() => false),
    getReviewTask: vi.fn(() => undefined),
    getReviewState: vi.fn(() => undefined),
    isReviewActive: vi.fn(() => false),
    addChild: vi.fn(() => undefined),
    ...overrides,
  } satisfies ReviewStore;
}

function createFakeDelegate(
  result: string | Promise<string> = "PASS",
): (
  config: PluginToolConfiguration,
  agentId: string,
  prompt: string,
  title: string,
  options?: DelegateOptions,
) => Promise<string> {
  return vi.fn(() => Promise.resolve(result));
}

function createFakeDeps(overrides: Partial<LoopReviewDeps> = {}): LoopReviewDeps {
  return {
    delegateToSubAgent: createFakeDelegate("PASS"),
    buildLoopMessage: (task, ...lines) => [task, ...lines].join("\n"),
    now: () => 12345,
    timeoutMs: 10,
    ...overrides,
  };
}

describe("loop-review", () => {
  test("empty task cancels loop", async () => {
    const reviewStore = createFakeReviewStore();
    const command = createLoopReviewCommand(createFakeDeps(), reviewStore);

    const result = await command.execute("ws1", "   ");

    expect(result).toBe("Loop mode cancelled.");
    expect(reviewStore.deactivateReview).toHaveBeenCalledWith("ws1");
  });

  test("already active returns message", async () => {
    const reviewStore = createFakeReviewStore({
      isReviewActive: vi.fn(() => true),
    });
    const command = createLoopReviewCommand(createFakeDeps(), reviewStore);

    const result = await command.execute("ws1", "task");

    expect(result).toBe(
      "Loop mode is already active. Submit your work via submit_review.",
    );
    expect(reviewStore.activateReview).not.toHaveBeenCalled();
  });

  test("no task service activates and returns message", async () => {
    const reviewStore = createFakeReviewStore();
    const command = createLoopReviewCommand(
      createFakeDeps({ taskService: undefined }),
      reviewStore,
    );

    const result = await command.execute("ws1", "task");

    expect(result).toContain("Loop mode is active (pre-review unavailable");
    expect(reviewStore.activateReview).toHaveBeenCalledWith(
      "ws1",
      "task",
      12345,
    );
  });

  test("passing pre-review activates and returns pass message", async () => {
    const reviewStore = createFakeReviewStore();
    const delegateToSubAgent = createFakeDelegate("PASS");
    const command = createLoopReviewCommand(
      createFakeDeps({
        delegateToSubAgent,
        taskService: {} as LoopReviewDeps["taskService"],
      }),
      reviewStore,
    );

    const result = await command.execute("ws1", "task");

    expect(delegateToSubAgent).toHaveBeenCalled();
    expect(result).toContain("Pre-review passed");
    expect(reviewStore.activateReview).toHaveBeenCalledWith(
      "ws1",
      "task",
      12345,
    );
  });

  test("failing pre-review returns feedback message", async () => {
    const reviewStore = createFakeReviewStore();
    const delegateToSubAgent = createFakeDelegate("Need more details");
    const command = createLoopReviewCommand(
      createFakeDeps({
        delegateToSubAgent,
        taskService: {} as LoopReviewDeps["taskService"],
      }),
      reviewStore,
    );

    const result = await command.execute("ws1", "task");

    expect(result).toContain("Pre-review feedback:");
    expect(result).toContain("Need more details");
    expect(reviewStore.activateReview).toHaveBeenCalledWith(
      "ws1",
      "task",
      12345,
    );
  });

  test("pre-review timeout resolves to PASS", async () => {
    const reviewStore = createFakeReviewStore();
    let releaseDelegate: (value: string) => void = () => undefined;
    const delegateToSubAgent = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseDelegate = resolve;
        }),
    );
    const command = createLoopReviewCommand(
      createFakeDeps({
        delegateToSubAgent,
        now: () => 100,
        timeoutMs: 1,
        taskService: {} as LoopReviewDeps["taskService"],
      }),
      reviewStore,
    );

    const result = await command.execute("ws1", "task");

    expect(delegateToSubAgent).toHaveBeenCalled();
    expect(result).toContain("Pre-review passed");
    expect(reviewStore.activateReview).toHaveBeenCalledWith("ws1", "task", 100);
    releaseDelegate("FAIL");
  });

  test("pre-review error resolves to PASS", async () => {
    const reviewStore = createFakeReviewStore();
    const delegateToSubAgent = vi.fn(() =>
      Promise.reject(new Error("subagent failed")),
    );
    const command = createLoopReviewCommand(
      createFakeDeps({
        delegateToSubAgent,
        taskService: {} as LoopReviewDeps["taskService"],
      }),
      reviewStore,
    );

    const result = await command.execute("ws1", "task");

    expect(result).toContain("Pre-review passed");
    expect(reviewStore.activateReview).toHaveBeenCalledWith(
      "ws1",
      "task",
      12345,
    );
  });
});
