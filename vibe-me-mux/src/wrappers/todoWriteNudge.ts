import type { ToolWrapper } from "../types/contract.js";
import { REVERIE_NUDGE } from "engine/todo";
import { mapResult, wrapExecute, type ToolMiddleware } from "./middleware.js";

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

export function createTodoWriteMiddleware(): ToolMiddleware {
  return mapResult((result) => appendReverieNudge(result));
}

export function createTodoWriteNudgeWrapper(): ToolWrapper {
  return {
    targetTool: "todo_write",
    wrapper: (tool) => wrapExecute(tool, createTodoWriteMiddleware()),
  };
}
