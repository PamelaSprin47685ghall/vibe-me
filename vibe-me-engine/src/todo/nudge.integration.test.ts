import { describe, expect, it } from 'vitest';
import { decideNudge } from "./nudge.js";
import type { NudgeContext } from "../types/nudge.js";

describe("Nudge Pure Decision Sandbox", () => {
  it("should prioritize runner nudge over todo/loop", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "",
      hasActiveRunner: true,
      isLoopActive: true,
    };
    expect(decideNudge(context)._tag).toBe("NudgeTodo");
  });

  it("should nudge todo when open todos exist without skip tag", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "I will work on this",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)._tag).toBe("NudgeTodo");
  });

  it("should skip todo nudge when tag is present", () => {
    const context: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: 'I will do it tomorrow <SKIP-TODO-CHECK />',
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should nudge loop when no todos and loop is active", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(context)._tag).toBe("NudgeLoop");
  });

  it("should skip loop nudge when tag is present", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "Review submitted <skip-loop-check />",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should return none when all todos are terminal", () => {
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
      lastAssistantMessage: "Would you like me to proceed?",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should skip loop nudge when last assistant message is a question", () => {
    const context: NudgeContext = {
      todos: [],
      lastAssistantMessage: "Should I submit the review now?",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(context)._tag).toBe("NudgeNone");
  });

  it("should handle case-insensitive skip tags", () => {
    const contextTodo: NudgeContext = {
      todos: ["pending"],
      lastAssistantMessage: "Working on it <Skip-Todo-Check/>",
      hasActiveRunner: false,
      isLoopActive: false,
    };
    expect(decideNudge(contextTodo)._tag).toBe("NudgeNone");

    const contextLoop: NudgeContext = {
      todos: [],
      lastAssistantMessage: "Done <SKIP-LOOP-CHECK/>",
      hasActiveRunner: false,
      isLoopActive: true,
    };
    expect(decideNudge(contextLoop)._tag).toBe("NudgeNone");
  });
});
