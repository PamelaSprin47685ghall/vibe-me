import { describe, expect, test } from "bun:test";
import { createEventHook } from "../eventHook.js";
import { createMockDeps, makeHelpers } from "./test-helpers.js";
import type { PluginEvent } from "../types/tool.js";

describe("createEventHook", () => {
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
    expect(mockShouldNudge).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        todos: ["pending"],
        lastAssistantMessage: "done",
      }),
    );
    expect(nudge).toHaveBeenCalledWith("ws1", "todo-nudge-prompt");
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
    expect(mockShouldNudge).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        todos: [],
        hasActiveRunner: true,
        isLoopActive: false,
      }),
    );
    expect(nudge).toHaveBeenCalledWith("ws1", "runner-nudge");
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

    expect(mockShouldNudge).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({
        lastAssistantMessage: "first\nsecond",
      }),
    );
  });
});
