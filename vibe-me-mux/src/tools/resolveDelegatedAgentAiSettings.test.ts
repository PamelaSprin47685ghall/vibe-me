import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PluginToolConfiguration } from "../types/tool.js";
import type {
  HostDependencies,
  AgentDefinitionPackage,
  AgentFrontmatterPackage,
  ConfigFile,
  AgentInheritanceRequest,
} from "../types/deps.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";

const mockLoadConfigOrDefault = mock<() => ConfigFile>(() => ({
  projects: new Map(),
  agentAiDefaults: {},
  subagentAiDefaults: {},
}));
const mockReadAgentDefinition = mock<
  (
    runtime: unknown,
    workspacePath: string,
    agentId: string,
  ) => Promise<AgentDefinitionPackage>
>((_runtime, _workspacePath, agentId) =>
  Promise.resolve({
    id: agentId,
    scope: "built-in",
    frontmatter: { name: agentId },
    body: "",
  }),
);
const mockResolveAgentFrontmatter = mock<
  (
    runtime: unknown,
    workspacePath: string,
    agentId: string,
  ) => Promise<AgentFrontmatterPackage>
>(() => Promise.resolve({ name: "" }));
const mockResolveAgentInheritanceChain = mock<
  (args: AgentInheritanceRequest) => Promise<{ id: string }[]>
>((args) => Promise.resolve([{ id: args.agentId }]));

function findWorkspaceEntryMock(
  configFile: ConfigFile,
  workspaceId: string,
):
  | {
      workspace: {
        id: string;
        aiSettings?: {
          model: string;
          thinkingLevel?: string;
        };
        aiSettingsByAgent?: Record<
          string,
          { model: string; thinkingLevel?: string }
        >;
      };
    }
  | undefined {
  for (const project of configFile.projects?.values() ?? []) {
    const found = project.workspaces.find((w) => w.id === workspaceId);
    if (found) return { workspace: found };
  }
  return undefined;
}

const mockDeps: HostDependencies = {
  log: { debug: () => undefined },
  loadConfigOrDefault: () => mockLoadConfigOrDefault(),
  readAgentDefinition: (runtime, workspacePath, agentId) =>
    mockReadAgentDefinition(runtime, workspacePath, agentId),
  resolveAgentFrontmatter: (runtime, workspacePath, agentId) =>
    mockResolveAgentFrontmatter(runtime, workspacePath, agentId),
  resolveAgentInheritanceChain: (args) => mockResolveAgentInheritanceChain(args),
  findWorkspaceEntry: findWorkspaceEntryMock,
};

const resolveDelegatedAgentAiSettings =
  createResolveDelegatedAgentAiSettings(mockDeps);

function createToolConfig(): PluginToolConfiguration {
  return {
    cwd: "/repo/workspace",
    runtime: null,
    workspaceId: "ws-1",
  };
}

beforeEach(() => {
  mockLoadConfigOrDefault.mockReset();
  mockReadAgentDefinition.mockReset();
  mockResolveAgentFrontmatter.mockReset();
  mockResolveAgentInheritanceChain.mockReset();

  mockLoadConfigOrDefault.mockImplementation(() => ({
    projects: new Map(),
    agentAiDefaults: {},
    subagentAiDefaults: {},
  }));
  mockReadAgentDefinition.mockImplementation(
    (_runtime, _workspacePath, agentId) =>
      Promise.resolve({
        id: agentId,
        scope: "built-in",
        frontmatter: { name: agentId },
        body: "",
      }),
  );
  mockResolveAgentFrontmatter.mockResolvedValue({ name: "" });
  mockResolveAgentInheritanceChain.mockImplementation((args) =>
    Promise.resolve([{ id: args.agentId }]),
  );
});

describe("resolveDelegatedAgentAiSettings", () => {
  test("explore inherits exec workspace settings instead of legacy workspace aiSettings", async () => {
    mockLoadConfigOrDefault.mockImplementation(() => ({
      projects: new Map([
        [
          "/repo",
          {
            workspaces: [
              {
                id: "ws-1",
                aiSettings: {
                  model: "random:current-model",
                  thinkingLevel: "low",
                },
                aiSettingsByAgent: {
                  exec: {
                    model: "openai:gpt-5.3-codex",
                    thinkingLevel: "xhigh",
                  },
                },
              },
            ],
          },
        ],
      ]),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));
    mockResolveAgentInheritanceChain.mockResolvedValue([
      { id: "explore" },
      { id: "exec" },
    ]);

    const result = await resolveDelegatedAgentAiSettings(
      createToolConfig(),
      "explore",
    );

    expect(result).toEqual({
      modelString: "openai:gpt-5.3-codex",
      thinkingLevel: "xhigh",
    });
  });

  test("exec keeps direct subagent overrides", async () => {
    mockLoadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {
        exec: {
          modelString: "openai:gpt-5.2",
          thinkingLevel: "medium",
        },
      },
      subagentAiDefaults: {
        exec: {
          modelString: "openai:gpt-5.3-codex",
          thinkingLevel: "xhigh",
        },
      },
    }));

    const result = await resolveDelegatedAgentAiSettings(
      createToolConfig(),
      "exec",
    );

    expect(result).toEqual({
      modelString: "openai:gpt-5.3-codex",
      thinkingLevel: "xhigh",
    });
  });

  test("desktop inherits exec model and keeps desktop descriptor thinking default", async () => {
    mockLoadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {
        exec: {
          modelString: "anthropic:claude-sonnet-4-5",
        },
      },
      subagentAiDefaults: {},
    }));
    mockResolveAgentInheritanceChain.mockResolvedValue([
      { id: "desktop" },
      { id: "exec" },
    ]);
    mockResolveAgentFrontmatter.mockResolvedValue({
      name: "desktop",
      ai: {
        thinkingLevel: "medium",
      },
    });

    const result = await resolveDelegatedAgentAiSettings(
      createToolConfig(),
      "desktop",
    );

    expect(result).toEqual({
      modelString: "anthropic:claude-sonnet-4-5",
      thinkingLevel: "medium",
    });
  });

  test("explore does not fall back to generic workspace aiSettings when aiSettingsByAgent is absent", async () => {
    mockLoadConfigOrDefault.mockImplementation(() => ({
      projects: new Map([
        [
          "/repo",
          {
            workspaces: [
              {
                id: "ws-1",
                aiSettings: {
                  model: "parent-model",
                  thinkingLevel: "high",
                },
              },
            ],
          },
        ],
      ]),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));
    mockResolveAgentInheritanceChain.mockResolvedValue([{ id: "explore" }]);

    const result = await resolveDelegatedAgentAiSettings(
      createToolConfig(),
      "explore",
    );

    expect(result).toEqual({
      modelString: undefined,
      thinkingLevel: undefined,
    });
  });
});
