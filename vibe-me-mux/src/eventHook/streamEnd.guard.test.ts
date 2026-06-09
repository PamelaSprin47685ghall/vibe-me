import { describe, expect, test } from "bun:test";
import { createEventHook } from "../eventHook.js";
import { createMockDeps, makeHelpers } from "./test-helpers.js";
import type { PluginEvent } from "../types/tool.js";

describe("createEventHook", () => {
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
