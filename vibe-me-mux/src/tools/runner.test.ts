import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createRunnerTool, type RunnerToolDeps } from "./runner.js";
import { createJobRegistry, type JobEntry } from "engine/runner";
import type { PluginToolConfiguration } from "../types/tool.js";
import type {
  ConfigFile,
  HostDependencies,
  TaskCreateInput,
  TaskCreateResult,
  TaskWaitOptions,
  TaskWaitResult,
} from "../types/deps.js";

function createMockRunnerDeps() {
  const mockExecute = mock(() =>
    Promise.resolve({ _tag: 'Completed' as const, output: 'command output' }),
  );
  const mockCleanupJob = mock(() => undefined);
  const mockGlobalJobRegistry = new Map<string, JobEntry>();

  return {
    mockExecute,
    mockCleanupJob,
    mockGlobalJobRegistry,
    runnerDeps: {
      execute: mockExecute,
      cleanupJob: mockCleanupJob,
      globalJobRegistry: mockGlobalJobRegistry,
    } satisfies RunnerToolDeps,
  };
}

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
  runnerJobs: createJobRegistry(),
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
  mockTaskService.create.mockReset();
  mockTaskService.waitForAgentReport.mockReset();
  mockLoadConfigOrDefault.mockReset();
  mockReadAgentDefinition.mockReset();
  mockResolveAgentInheritanceChain.mockReset();
  mockResolveAgentFrontmatter.mockReset();

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
    const { runnerDeps } = createMockRunnerDeps();

    const result = await createRunnerTool(mockDeps, runnerDeps).execute(
      createToolConfig(),
      {
        language: "shell",
        program: "printf hi",
        dependencies: [],
        what_to_summarize: "summarize output",
      },
    );

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
