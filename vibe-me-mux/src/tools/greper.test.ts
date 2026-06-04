import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PluginToolConfiguration } from "../types/tool.js";
import { FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME } from "../types/contract.js";
import type {
  HostDependencies,
  TaskCreateInput,
  TaskCreateResult,
  TaskServiceLike,
  TaskWaitResult,
} from "../types/deps.js";
import { createGreperTool } from "./greper.js";

class ForegroundWaitBackgroundedError extends Error {
  constructor() {
    super("Foreground wait sent to background due to queued message");
    this.name = FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME;
  }
}

const mockTaskService: {
  create: ReturnType<
    typeof mock<(input: TaskCreateInput) => Promise<TaskCreateResult>>
  >;
  waitForAgentReport: ReturnType<
    typeof mock<
      (
        taskId: string,
        opts: {
          requestingWorkspaceId: string;
          abortSignal?: AbortSignal;
        },
      ) => Promise<TaskWaitResult>
    >
  >;
} = {
  create: mock<
    (input: TaskCreateInput) => Promise<TaskCreateResult>
  >(),
  waitForAgentReport: mock<
    (
      taskId: string,
      opts: {
        requestingWorkspaceId: string;
        abortSignal?: AbortSignal;
      },
    ) => Promise<TaskWaitResult>
  >(),
};

const mockDeps: HostDependencies = {
  log: { debug: () => undefined },
  defaultModel: "anthropic:claude-sonnet-4-5",
  loadConfigOrDefault: () => ({
    projects: new Map(),
    agentAiDefaults: {},
    subagentAiDefaults: {
      explore: {
        modelString: "anthropic:claude-sonnet-4-5",
        thinkingLevel: "medium",
      },
    },
  }),
  readAgentDefinition: () => Promise.reject(new Error("not used")),
  resolveAgentFrontmatter: () => Promise.reject(new Error("not used")),
  resolveAgentInheritanceChain: () => Promise.resolve([{ id: "explore" }]),
  findWorkspaceEntry: () => undefined,
};

function createToolConfig(): PluginToolConfiguration {
  return {
    cwd: "/repo/workspace",
    runtime: null,
    workspaceId: "ws-test",
    taskService: mockTaskService as unknown as TaskServiceLike,
  };
}

const greperDef = createGreperTool(mockDeps);

beforeEach(() => {
  mockTaskService.create.mockReset();
  mockTaskService.waitForAgentReport.mockReset();
});

describe("greper tool", () => {
  test("creates explore agent task with correct intent", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "task-123", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockResolvedValue({
      reportMarkdown: "Found 3 matches in src/utils.ts",
    });

    const result = await greperDef.execute(createToolConfig(), {
      intent: "find all usages of getUserName function",
    });

    expect(mockTaskService.create).toHaveBeenCalledWith({
      parentWorkspaceId: "ws-test",
      kind: "agent",
      agentId: "explore",
      modelString: "anthropic:claude-sonnet-4-5",
      thinkingLevel: "medium",
      prompt: "find all usages of getUserName function",
      title: "Greper",
    });
    expect(mockTaskService.waitForAgentReport).toHaveBeenCalledWith(
      "task-123",
      {
        requestingWorkspaceId: "ws-test",
        abortSignal: undefined,
      },
    );
    expect(result).toBe("Found 3 matches in src/utils.ts");
  });

  test("returns error message when task creation fails", async () => {
    mockTaskService.create.mockResolvedValue({
      success: false,
      error: "Max nesting depth exceeded",
    });

    const result = await greperDef.execute(createToolConfig(), {
      intent: "search for config files",
    });

    expect(result).toBe(
      "Failed to create greper task: Max nesting depth exceeded",
    );
    expect(mockTaskService.waitForAgentReport).not.toHaveBeenCalled();
  });

  test("handles backgrounding scenario", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "task-456", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockRejectedValue(
      new ForegroundWaitBackgroundedError(),
    );

    const result = await greperDef.execute(createToolConfig(), {
      intent: "find all TODO comments",
    });

    expect(result).toBe(
      "Greper task (task-456) moved to background. Use task tools to monitor it.",
    );
  });

  test("rethrows non-backgrounding errors", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "task-789", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockRejectedValue(
      new Error("Network timeout"),
    );

    let caught: unknown;
    try {
      await greperDef.execute(createToolConfig(), {
        intent: "search for imports",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Network timeout");
  });
});
