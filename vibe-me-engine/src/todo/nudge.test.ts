import { describe, expect, it } from "bun:test";
import { decideNudge, type NudgeInputContext } from "./index.js";

describe("Nudge Decision Engine - Pure Logic Tests", () => {
  it("should prioritize running job nudge over todo reminders", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: undefined,
      hasActiveRunner: true,
      isLoopActive: false,
    };

    const decision = decideNudge(context);
    expect(decision).toBe("nudge-todo");
  });

  it("should return nudge-todo if open todos exist and skip tag is absent", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: undefined,
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)).toBe("nudge-todo");
  });

  it("should respect skip tag and bypass todo nudge", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: "Working on it. <skip-todo-check />",
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)).toBe("none");
  });

  it("should nudge review loop if all todos are done and loop is active", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "completed" }],
      lastAssistantMessage: undefined,
      hasActiveRunner: false,
      isLoopActive: true,
    };

    expect(decideNudge(context)).toBe("nudge-loop");
  });

  it("should return none if todos are done and loop is not active", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "completed" }],
      lastAssistantMessage: undefined,
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)).toBe("none");
  });

  it("should skip todo nudge when last assistant message is a question", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "pending" }],
      lastAssistantMessage: "Do you want me to continue?",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)).toBe("none");
  });

  it("should return none when all conditions are met but skip-loop-check is present", () => {
    const context: NudgeInputContext = {
      todos: [{ status: "completed" }],
      lastAssistantMessage: "All done. <skip-loop-check />",
      hasActiveRunner: false,
      isLoopActive: true,
    };

    expect(decideNudge(context)).toBe("none");
  });
});
