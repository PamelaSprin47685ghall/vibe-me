import { describe, expect, test } from "bun:test";
import { createEventHook } from "../eventHook.js";
import { createMockDeps } from "./test-helpers.js";
import type { PluginEvent } from "../types/tool.js";

describe("createEventHook", () => {
  test("stream-abort deactivates review and clears iterator scope", () => {
    const { deps, mockDeactivateReview, mockClearIteratorScope } = createMockDeps();
    const event: PluginEvent = { type: "stream-abort", workspaceId: "ws1" };
    const hook = createEventHook(deps);
    void hook(event);
    expect(mockDeactivateReview).toHaveBeenCalledWith("ws1");
    expect(mockClearIteratorScope).toHaveBeenCalledWith("ws1");
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
