import type { ToolLike, ToolWrapper, PluginToolArgs } from "../types/contract.js";

const REVERIE_NUDGE = "// 三思而后行——建议立刻调用 reverie 工具提升思维";

function wrapTodoWrite(baseTool: ToolLike): ToolLike {
  const originalExecute = baseTool.execute;
  if (typeof originalExecute !== "function") return baseTool;

  return {
    ...baseTool,
    execute: ((
      args: PluginToolArgs,
      options?: { readonly abortSignal?: AbortSignal },
    ) => {
      const result = originalExecute.call(baseTool, args, options);
      if (result instanceof Promise) {
        return result.then((resolved: unknown) => appendReverieNudge(resolved));
      }
      return appendReverieNudge(result);
    }) as ToolLike["execute"],
  };
}

function appendReverieNudge(result: unknown): unknown {
  if (typeof result === "string") {
    return result.includes(REVERIE_NUDGE) ? result : `${result}\n\n${REVERIE_NUDGE}`;
  }
  if (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    (result as { success: unknown }).success === true
  ) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.nudge === "string" && obj.nudge.includes(REVERIE_NUDGE)) return result;
    return { ...obj, nudge: REVERIE_NUDGE };
  }
  return result;
}

export function createTodoWriteNudgeWrapper(): ToolWrapper {
  return {
    targetTool: "todo_write",
    wrapper: (tool) => wrapTodoWrite(tool),
  };
}
