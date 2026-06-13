import { beforeEach, describe, expect, vi, test } from 'vitest';
import { createExecutorTool, type ExecutorToolDeps } from "./executor.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type {
  ConfigFile,
  HostDependencies,
  TaskCreateInput,
  TaskCreateResult,
  TaskWaitOptions,
  TaskWaitResult,
} from "../types/deps.js";
import type { ExecuteResult } from "engine/executor";

const SHORT_TEXT = "ok";
const LONG_TEXT = "x".repeat(9_000);

function makeExecutorDeps(execResult: ExecuteResult) {
  const execute = vi.fn<(options: unknown, sessionId: string) => Promise<ExecuteResult>>(() =>
    Promise.resolve(execResult),
  );
  const resolveAiSettings = vi.fn<NonNullable<ExecutorToolDeps["resolveAiSettings"]>>(() =>
    Promise.resolve({ modelString: "anthropic:claude-explore", thinkingLevel: "medium" }),
  );
  return { execute, resolveAiSettings, deps: { execute, resolveAiSettings } satisfies ExecutorToolDeps };
}

function createConfigFile(): ConfigFile {
  return {
    projects: new Map([
      [
        "/repo",
        {
          workspaces: [
            {
              id: "ws-executor",
              aiSettingsByAgent: {
                exec: { model: "openai:gpt-parent", thinkingLevel: "high" },
              },
            },
          ],
        },
      ],
    ]),
    agentAiDefaults: {},
    subagentAiDefaults: {
      explore: { modelString: "anthropic:claude-explore", thinkingLevel: "medium" },
    },
  };
}

const mockTaskService: {
  readonly create: ReturnType<typeof vi.fn<(input: TaskCreateInput) => Promise<TaskCreateResult>>>;
  readonly waitForAgentReport: ReturnType<
    typeof vi.fn<(taskId: string, opts: TaskWaitOptions) => Promise<TaskWaitResult>>
  >;
} = {
  create: vi.fn<(input: TaskCreateInput) => Promise<TaskCreateResult>>(),
  waitForAgentReport: vi.fn<(taskId: string, opts: TaskWaitOptions) => Promise<TaskWaitResult>>(),
};

const mockLoadConfigOrDefault = vi.fn<() => ConfigFile>(createConfigFile);
const mockReadAgentDefinition = vi.fn<HostDependencies["readAgentDefinition"]>(
  async (_runtime, _workspacePath, agentId) => ({ id: agentId, scope: "built-in", frontmatter: { name: agentId }, body: "" }),
);
const mockResolveAgentInheritanceChain = vi.fn<HostDependencies["resolveAgentInheritanceChain"]>(
  () => Promise.resolve([{ id: "explore" }, { id: "exec" }]),
);
const mockResolveAgentFrontmatter = vi.fn<HostDependencies["resolveAgentFrontmatter"]>(
  () => Promise.resolve({ name: "explore" }),
);

const mockDeps: HostDependencies = {
  log: { debug: () => undefined },
  loadConfigOrDefault: mockLoadConfigOrDefault,
  readAgentDefinition: mockReadAgentDefinition,
  resolveAgentFrontmatter: mockResolveAgentFrontmatter,
  resolveAgentInheritanceChain: mockResolveAgentInheritanceChain,
  findWorkspaceEntry: (configFile, workspaceId) => {
    for (const project of configFile.projects?.values() ?? []) {
      const workspace = project.workspaces.find((w) => w.id === workspaceId);
      if (workspace) return { workspace };
    }
    return undefined;
  },
};

function createToolConfig(): PluginToolConfiguration {
  return { cwd: "/repo/workspace", runtime: null, workspaceId: "ws-executor", taskService: mockTaskService };
}

beforeEach(() => {
  mockTaskService.create.mockReset();
  mockTaskService.waitForAgentReport.mockReset();
  mockLoadConfigOrDefault.mockReset();
  mockReadAgentDefinition.mockReset();
  mockResolveAgentInheritanceChain.mockReset();
  mockResolveAgentFrontmatter.mockReset();
  mockLoadConfigOrDefault.mockImplementation(createConfigFile);
  mockReadAgentDefinition.mockImplementation(
    async (_runtime, _workspacePath, agentId) => ({ id: agentId, scope: "built-in", frontmatter: { name: agentId }, body: "" }),
  );
  mockResolveAgentInheritanceChain.mockResolvedValue([{ id: "explore" }, { id: "exec" }]);
  mockResolveAgentFrontmatter.mockResolvedValue({ name: "explore" });
});

describe("executor tool", () => {
  test("returns output directly when under the 8192 byte threshold", async () => {
    mockTaskService.create.mockResolvedValue({ success: true, data: { taskId: "x", kind: "agent", status: "running" } });
    const { deps } = makeExecutorDeps({ _tag: "Completed", output: SHORT_TEXT });
    const result = await createExecutorTool(mockDeps, deps).execute(createToolConfig(), {
      language: "shell",
      program: "echo ok",
      timeout_type: "short",
    });
    expect(result).toBe(SHORT_TEXT);
    expect(mockTaskService.create).not.toHaveBeenCalled();
  });

  test("spawns a tightly-scoped summarizer subagent for large output", async () => {
    mockTaskService.create.mockResolvedValue({
      success: true,
      data: { taskId: "summary-1", kind: "agent", status: "running" },
    });
    mockTaskService.waitForAgentReport.mockResolvedValue({ reportMarkdown: "summary-text" });
    const { deps } = makeExecutorDeps({ _tag: "Completed", output: LONG_TEXT });

    const result = await createExecutorTool(mockDeps, deps).execute(createToolConfig(), {
      language: "shell",
      program: "cat huge.txt",
      timeout_type: "long",
    });

    expect(result).toBe("summary-text");
    const call = mockTaskService.create.mock.calls[0]?.[0];
    expect(call?.agentId).toBe("explore");
    expect(call?.modelString).toBe("anthropic:claude-explore");
    expect(call?.experiments?.subagentRole).toBe("summarizer");
    const disabled = call?.experiments?.toolPolicy?.disabledTools ?? [];
    expect(disabled).toContain("read");
    expect(disabled).toContain("write");
    expect(disabled).toContain("edit");
    expect(disabled).toContain("executor");
    expect(disabled).toContain("bash");
    expect(disabled).toContain("bash_.*");
    expect(disabled).toContain("task");
    expect(disabled).toContain("task_.*");
    expect(disabled).not.toContain("agent_report");
  });

  test("falls back to raw output when no taskService is configured", async () => {
    const cfg = createToolConfig();
    const cfgNoTask = { ...cfg, taskService: undefined };
    const { deps } = makeExecutorDeps({ _tag: "Completed", output: LONG_TEXT });
    const result = await createExecutorTool(mockDeps, deps).execute(cfgNoTask, {
      language: "shell",
      program: "cat huge.txt",
      timeout_type: "long",
    });
    expect(result).toContain(LONG_TEXT);
    expect(result).toContain("no taskService");
  });

  test("returns an error string for unknown timeout_type", async () => {
    const { deps } = makeExecutorDeps({ _tag: "Completed", output: SHORT_TEXT });
    const result = await createExecutorTool(mockDeps, deps).execute(createToolConfig(), {
      language: "shell",
      program: "echo x",
      timeout_type: "medium",
    } as never);
    expect(result).toMatch(/timeout_type/);
  });
});
