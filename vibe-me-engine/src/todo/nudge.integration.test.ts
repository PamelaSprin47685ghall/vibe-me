import { describe, expect, it } from "bun:test";
import { decideNudge, type NudgeInputContext } from "./index.js";

describe("Nudge Pure Decision Sandbox", () => {
  it("should prioritize runner nudge over todo/loop", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      hasActiveRunner: true,
      isLoopActive: true,
    };
    expect(decideNudge(context)).toBe("nudge-runner");
  });

  it("should nudge todo when open todos exist without skip tag", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: "I will work on this",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)).toBe("nudge-todo");
  });

  it("should skip todo nudge when tag is present", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: "I will do it tomorrow <SKIP-TODO-CHECK />",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)).toBe("none");
  });

  it("should nudge loop when no todos and loop is active", () => {
    const context: NudgeInputContext = {
      todos: [],
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(context)).toBe("nudge-loop");
  });

  it("should skip loop nudge when tag is present", () => {
    const context: NudgeInputContext = {
      todos: [],
      lastAssistantMessage: "Review submitted <skip-loop-check />",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(context)).toBe("none");
  });

  it("should return none when all todos are terminal", () => {
    const context: NudgeInputContext = {
      todos: [
        { status: "completed" },
        { status: "cancelled" },
        { status: "abandoned" },
      ],
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)).toBe("none");
  });

  it("should handle case-insensitive skip tags", () => {
    const contextTodo: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: "Working on it <Skip-Todo-Check/>",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(contextTodo)).toBe("none");

    const contextLoop: NudgeInputContext = {
      todos: [],
      lastAssistantMessage: "Done <SKIP-LOOP-CHECK/>",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(contextLoop)).toBe("none");
  });
});
