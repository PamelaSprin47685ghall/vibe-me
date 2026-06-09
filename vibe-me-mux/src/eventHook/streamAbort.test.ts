import { describe, expect, test } from "bun:test";
import { createEventHook } from "../eventHook.js";
import { createMockDeps } from "./test-helpers.js";
import type { PluginEvent } from "../types/tool.js";

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
});
