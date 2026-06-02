import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PluginToolConfiguration } from "../types/tool";
import { FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME } from "../types/tool";
import type { ToolExecutionOptions } from "ai";
import type { HostDependencies, TaskCreateInput, TaskCreateResult, TaskServiceLike, TaskWaitResult } from "../types/deps";
import { createRegistration } from "../index";

class ForegroundWaitBackgroundedError extends Error {
  constructor() {
    super("Foreground wait sent to background due to queued message");
    this.name = FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME;
  }
}

const mockTaskService: {
  create: ReturnType<typeof mock<(input: TaskCreateInput) => Promise<TaskCreateResult>>>;
  waitForAgentReport: ReturnType<typeof mock<(taskId: string, opts: { requestingWorkspaceId: string; abortSignal?: AbortSignal }) => Promise<TaskWaitResult>>>;
} = {
  create: mock<(input: TaskCreateInput) => Promise<TaskCreateResult>>(),
  waitForAgentReport: mock<(taskId: string, opts: { requestingWorkspaceId: string; abortSignal?: AbortSignal }) => Promise<TaskWaitResult>>(),
};

const mockDeps: HostDependencies = {
  log: { debug: () => undefined },
  defaultModel: "anthropic:claude-sonnet-4-5",
  loadConfigOrDefault: () => ({
    projects: new Map(),
    agentAiDefaults: {},
    subagentAiDefaults: { explore: { modelString: "anthropic:claude-sonnet-4-5", thinkingLevel: "medium" } },
  }),
  readAgentDefinition: () => Promise.reject(new Error("not used")),
  resolveAgentFrontmatter: () => Promise.reject(new Error("not used")),
  resolveAgentInheritanceChain: () => Promise.resolve([{ id: "explore" }]),
  findWorkspaceEntry: () => undefined,
};

function bootstrap() {
  const registration = createRegistration(mockDeps);
  const greperEntry = registration.tools.find((t) => t.name === "greper");
  if (!greperEntry) throw new Error("greper tool missing");
  return greperEntry.factory;
}

const mockToolCallOptions: ToolExecutionOptions = {
  toolCallId: "test-call-id",
  messages: [],
};

function createToolConfig(): PluginToolConfiguration {
  return {
    cwd: "/repo/workspace",
    runtime: null,
    workspaceId: "ws-test",
    taskService: mockTaskService as unknown as TaskServiceLike,
  };
}

const createGreperTool = bootstrap();

beforeEach(() => {
  bootstrap();
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

    const tool = createGreperTool(createToolConfig());
    const result: string = (await tool.execute!(
      { intent: "find all usages of getUserName function" },
      { ...mockToolCallOptions, abortSignal: new AbortController().signal }
    )) as string;

    expect(mockTaskService.create).toHaveBeenCalledWith({
      parentWorkspaceId: "ws-test",
      kind: "agent",
      agentId: "explore",
      modelString: "anthropic:claude-sonnet-4-5",
      thinkingLevel: "medium",
      prompt: "find all usages of getUserName function",
      title: "Greper",
    });
    expect(mockTaskService.waitForAgentReport).toHaveBeenCalledWith("task-123", {
      requestingWorkspaceId: "ws-test",
      abortSignal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(result).toBe("Found 3 matches in src/utils.ts");
  });

  test("returns error message when task creation fails", async () => {
    mockTaskService.create.mockResolvedValue({
      success: false,
      error: "Max nesting depth exceeded",
    });

    const tool = createGreperTool(createToolConfig());
    const result: string = (await tool.execute!(
      { intent: "search for config files" },
      { ...mockToolCallOptions, abortSignal: new AbortController().signal }
    )) as string;

    expect(result).toBe("Failed to create greper task: Max nesting depth exceeded");
    expect(mockTaskService.waitForAgentReport).not.toHaveBeenCalled();
  });

  test("handles backgrounding scenario", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "task-456", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockRejectedValue(new ForegroundWaitBackgroundedError());

    const tool = createGreperTool(createToolConfig());
    const result: string = (await tool.execute!(
      { intent: "find all TODO comments" },
      { ...mockToolCallOptions, abortSignal: new AbortController().signal }
    )) as string;

    expect(result).toBe(
      "Greper task (task-456) moved to background. Use task tools to monitor it."
    );
  });

  test("rethrows non-backgrounding errors", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "task-789", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockRejectedValue(new Error("Network timeout"));

    const tool = createGreperTool(createToolConfig());

    let caught: unknown;
    try {
      await tool.execute!(
        { intent: "search for imports" },
        { ...mockToolCallOptions, abortSignal: new AbortController().signal }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Network timeout");
  });
});
