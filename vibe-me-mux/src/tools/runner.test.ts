import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PluginToolConfiguration } from "../types/tool.js";
import type {
  ConfigFile,
  HostDependencies,
  TaskCreateInput,
  TaskCreateResult,
  TaskWaitOptions,
  TaskWaitResult,
} from "../types/deps.js";

interface RunnerExecuteInput {
  readonly sessionId: string;
  readonly parentSessionId: string;
  readonly program: string;
  readonly language: "shell" | "python" | "javascript";
  readonly dependencies?: readonly string[];
  readonly cwd: string;
}

interface RunnerExecuteResult {
  readonly background: false;
  readonly output: string;
}

const mockExecute = mock<
  (input: RunnerExecuteInput) => Promise<RunnerExecuteResult>
>(() => Promise.resolve({ background: false, output: "command output" }));
const mockCleanupJob = mock<(jobId: string) => void>();
const mockGlobalJobRegistry = new Map<string, { taskId?: string }>();

mock.module("engine/runner", () => ({
  execute: mockExecute,
  cleanupJob: mockCleanupJob,
  globalJobRegistry: mockGlobalJobRegistry,
}));

mock.module("engine/runner/read-commands", () => ({
  EXTENDED_SHELL_READ_COMMANDS: new Set<string>(),
}));

const { createRunnerTool } = await import("./runner.js");

function createConfigFile(): ConfigFile {
  return {
    projects: new Map([
      [
        "/repo",
        {
          workspaces: [
            {
              id: "ws-runner",
              aiSettingsByAgent: {
                exec: {
                  model: "openai:gpt-parent",
                  thinkingLevel: "high",
                },
              },
            },
          ],
        },
      ],
    ]),
    agentAiDefaults: {},
    subagentAiDefaults: {
      explore: {
        modelString: "anthropic:claude-explore",
        thinkingLevel: "medium",
      },
    },
  };
}

const mockTaskService: {
  readonly create: ReturnType<
    typeof mock<(input: TaskCreateInput) => Promise<TaskCreateResult>>
  >;
  readonly waitForAgentReport: ReturnType<
    typeof mock<
      (taskId: string, opts: TaskWaitOptions) => Promise<TaskWaitResult>
    >
  >;
} = {
  create: mock<(input: TaskCreateInput) => Promise<TaskCreateResult>>(),
  waitForAgentReport: mock<
    (taskId: string, opts: TaskWaitOptions) => Promise<TaskWaitResult>
  >(),
};

const mockLoadConfigOrDefault = mock<() => ConfigFile>(createConfigFile);
const mockReadAgentDefinition = mock<HostDependencies["readAgentDefinition"]>(
  async (_runtime, _workspacePath, agentId) => ({
    id: agentId,
    scope: "built-in",
    frontmatter: { name: agentId },
    body: "",
  }),
);
const mockResolveAgentInheritanceChain = mock<
  HostDependencies["resolveAgentInheritanceChain"]
>(() => Promise.resolve([{ id: "explore" }, { id: "exec" }]));
const mockResolveAgentFrontmatter = mock<
  HostDependencies["resolveAgentFrontmatter"]
>(() => Promise.resolve({ name: "explore" }));

const mockDeps: HostDependencies = {
  log: { debug: () => undefined },
  loadConfigOrDefault: mockLoadConfigOrDefault,
  readAgentDefinition: mockReadAgentDefinition,
  resolveAgentFrontmatter: mockResolveAgentFrontmatter,
  resolveAgentInheritanceChain: mockResolveAgentInheritanceChain,
  findWorkspaceEntry: (configFile, workspaceId) => {
    for (const project of configFile.projects?.values() ?? []) {
      const workspace = project.workspaces.find(
        (candidate) => candidate.id === workspaceId,
      );
      if (workspace) return { workspace };
    }
    return undefined;
  },
};

function createToolConfig(): PluginToolConfiguration {
  return {
    cwd: "/repo/workspace",
    runtime: null,
    workspaceId: "ws-runner",
    taskService: mockTaskService,
  };
}

beforeEach(() => {
  mockExecute.mockReset();
  mockCleanupJob.mockReset();
  mockGlobalJobRegistry.clear();
  mockTaskService.create.mockReset();
  mockTaskService.waitForAgentReport.mockReset();
  mockLoadConfigOrDefault.mockReset();
  mockReadAgentDefinition.mockReset();
  mockResolveAgentInheritanceChain.mockReset();
  mockResolveAgentFrontmatter.mockReset();

  mockExecute.mockResolvedValue({ background: false, output: "command output" });
  mockTaskService.create.mockResolvedValue({
    success: true,
    data: { taskId: "runner-task-1", kind: "agent", status: "running" },
  });
  mockTaskService.waitForAgentReport.mockResolvedValue({
    reportMarkdown: "summary",
  });
  mockLoadConfigOrDefault.mockImplementation(createConfigFile);
  mockReadAgentDefinition.mockImplementation(
    async (_runtime, _workspacePath, agentId) => ({
      id: agentId,
      scope: "built-in",
      frontmatter: { name: agentId },
      body: "",
    }),
  );
  mockResolveAgentInheritanceChain.mockResolvedValue([
    { id: "explore" },
    { id: "exec" },
  ]);
  mockResolveAgentFrontmatter.mockResolvedValue({ name: "explore" });
});

describe("runner tool", () => {
  test("creates runner summary task with explicit explore model settings", async () => {
    const result = await createRunnerTool(mockDeps).execute(createToolConfig(), {
      language: "shell",
      program: "printf hi",
      dependencies: [],
      what_to_summarize: "summarize output",
    });

    const createInput = mockTaskService.create.mock.calls[0]?.[0];

    expect(result).toBe("summary");
    expect(mockTaskService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "explore",
        modelString: "anthropic:claude-explore",
        thinkingLevel: "medium",
      }),
    );
    expect(createInput?.modelString).not.toBe("openai:gpt-parent");
    expect(createInput?.thinkingLevel).not.toBe("high");
  });
});
