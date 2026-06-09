import { describe, expect, it } from "bun:test";
import { decideNudge } from "../kernel/todo.js";
import type { NudgeContext } from "../kernel/types.js";

describe("Nudge Decision Engine - Pure Logic Tests", () => {
  it("should return nudge-todo when both todos and active runner exist", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "",
      hasActiveRunner: true,
      isLoopActive: false,
    };

    expect(decideNudge(context)._tag).toBe("NudgeTodo");
  });

  it("should return nudge-todo if open todos exist and skip tag is absent", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "",
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)._tag).toBe("NudgeTodo");
  });

  it("should respect skip tag and bypass todo nudge", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "Working on it. <skip-todo-check />",
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should nudge review loop if all todos are done and loop is active", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "",
      hasActiveRunner: false,
      isLoopActive: true,
    };

    expect(decideNudge(context)._tag).toBe("NudgeLoop");
  });

  it("should return none if todos are done and loop is not active", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "",
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should skip todo nudge when last assistant message is a question", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "Do you want me to continue?",
      hasActiveRunner: false,
      isLoopActive: false,
    };

    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should return none when all conditions are met but skip-loop-check is present", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "All done. <skip-loop-check />",
      hasActiveRunner: false,
      isLoopActive: true,
    };

    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });
});
