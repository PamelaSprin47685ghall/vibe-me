import type { ToolLike, ToolWrapper } from "../types/contract.js";
import { REVERIE_NUDGE } from "engine/todo";

function wrapTodoWrite(baseTool: ToolLike): ToolLike {
  const originalExecute = baseTool.execute;
  if (typeof originalExecute !== "function") return baseTool;

  return {
    ...baseTool,
    execute: ((
      args: Record<string, unknown>,
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
