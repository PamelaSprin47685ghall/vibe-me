import { describe, expect, test, mock } from "bun:test";
import { createTodoWriteNudgeWrapper } from "./todoWriteNudge.js";
import type { ToolLike, PluginToolArgs } from "../types/contract.js";

const NUDGE = "// Think thrice before acting — consider calling reverie tool to improve reasoning";

function makeBaseTool(executeResult: unknown): ToolLike {
  return {
    name: "todo_write",
    description: "todo_write tool",
    execute: mock(() => executeResult) as ToolLike["execute"],
  };
}

const config = { cwd: "/repo", runtime: null } as never;

describe("createTodoWriteNudgeWrapper", () => {
  test("targets todo_write", () => {
    const wrapper = createTodoWriteNudgeWrapper();
    expect(wrapper.targetTool).toBe("todo_write");
  });

  test("appends nudge to object success result", async () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base = makeBaseTool({ success: true as const, count: 3 });

    const wrapped = wrapper.wrapper(base, config);
    const result = await (wrapped.execute as (...args: readonly unknown[]) => Promise<unknown>)(
      {} as PluginToolArgs,
    );

    expect(result).toEqual({
      success: true,
      count: 3,
      nudge: NUDGE,
    });
  });

  test("appends nudge to string result", async () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base = makeBaseTool("ok");

    const wrapped = wrapper.wrapper(base, config);
    const result = await (wrapped.execute as (...args: readonly unknown[]) => Promise<unknown>)(
      {} as PluginToolArgs,
    );

    expect(result).toBe(`ok\n\n${NUDGE}`);
  });

  test("does not duplicate nudge on repeated invocations", async () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base = makeBaseTool({ success: true as const, count: 1 });

    const wrapped = wrapper.wrapper(base, config);
    const exec = wrapped.execute as (...args: readonly unknown[]) => Promise<unknown>;
    const first = (await exec({} as PluginToolArgs)) as { nudge: string };
    base.execute = mock(() => first) as ToolLike["execute"];

    const second = (await exec({} as PluginToolArgs)) as { nudge: string };
    expect(second.nudge).toBe(NUDGE);
  });

  test("passes through non-success object untouched", async () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base = makeBaseTool({ success: false, error: "x" });

    const wrapped = wrapper.wrapper(base, config);
    const result = await (wrapped.execute as (...args: readonly unknown[]) => Promise<unknown>)(
      {} as PluginToolArgs,
    );

    expect(result).toEqual({ success: false, error: "x" });
  });

  test("handles synchronous execute", () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base = makeBaseTool({ success: true as const, count: 0 });

    const wrapped = wrapper.wrapper(base, config);
    const result = (wrapped.execute as (...args: readonly unknown[]) => unknown)({} as PluginToolArgs);

    expect(result).toEqual({
      success: true,
      count: 0,
      nudge: NUDGE,
    });
  });

  test("forwards args and options to the original tool", async () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const original = mock(() => ({ success: true as const, count: 0 }));
    const base: ToolLike = { name: "todo_write", execute: original as ToolLike["execute"] };

    const wrapped = wrapper.wrapper(base, config);
    const args = { todos: [] } as unknown as PluginToolArgs;
    const options = { abortSignal: new AbortController().signal };
    await (wrapped.execute as (...args: readonly unknown[]) => Promise<unknown>)(args, options);

    expect(original).toHaveBeenCalledTimes(1);
    const callArgs = original.mock.calls[0] as unknown as readonly unknown[];
    expect(callArgs[0]).toBe(args);
    expect(callArgs[1]).toBe(options);
  });

  test("returns base tool unchanged when execute is missing", () => {
    const wrapper = createTodoWriteNudgeWrapper();
    const base: ToolLike = { name: "todo_write" };
    const wrapped = wrapper.wrapper(base, config);
    expect(wrapped).toBe(base);
  });
});
