import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ToolConfiguration } from "../types/tool";
import type {
  MuxDeps,
  AgentDefinition,
  AgentFrontmatter,
  ConfigFile,
  AgentInheritanceArgs,
  AgentInheritanceEntry,
} from "../types/deps";

const mockLoadConfigOrDefault = mock<() => ConfigFile>(() => ({
  projects: new Map(),
  agentAiDefaults: {},
  subagentAiDefaults: {},
}));
const mockReadAgentDefinition = mock(
  (_runtime: unknown, _workspacePath: string, agentId: string) =>
    Promise.resolve({
      id: agentId,
      scope: "built-in",
      frontmatter: { name: agentId },
      body: "",
    } satisfies AgentDefinition),
);
const mockResolveAgentFrontmatter = mock<() => Promise<AgentFrontmatter>>(() =>
  Promise.resolve({ name: "" }),
);
const mockResolveAgentInheritanceChain = mock<
  (args: AgentInheritanceArgs) => Promise<AgentInheritanceEntry[]>
>((args) => Promise.resolve([{ id: args.agentId }]));

function findWorkspaceEntryMock(
  configFile: ConfigFile,
  workspaceId: string,
): { workspace: { id: string; aiSettings?: { model: string; thinkingLevel?: string }; aiSettingsByAgent?: Record<string, { model: string; thinkingLevel?: string }> } } | undefined {
  for (const project of configFile.projects?.values() ?? []) {
    const found = project.workspaces.find((w) => w.id === workspaceId);
    if (found) return { workspace: found };
  }
  return undefined;
}

const mockDeps: MuxDeps = {
  log: { debug: () => undefined },
  defaultModel: "anthropic:claude-sonnet-4-5",
  loadConfigOrDefault: mockLoadConfigOrDefault as unknown as MuxDeps["loadConfigOrDefault"],
  readAgentDefinition: mockReadAgentDefinition as unknown as MuxDeps["readAgentDefinition"],
  resolveAgentFrontmatter: mockResolveAgentFrontmatter as unknown as MuxDeps["resolveAgentFrontmatter"],
  resolveAgentInheritanceChain: mockResolveAgentInheritanceChain as unknown as MuxDeps["resolveAgentInheritanceChain"],
  findWorkspaceEntry: findWorkspaceEntryMock,
};

import { createRegistration } from "../index";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

function createToolConfig(): ToolConfiguration {
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

  createRegistration(mockDeps);

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
    mockResolveAgentInheritanceChain.mockResolvedValue([{ id: "explore" }, { id: "exec" }]);

    const result = await resolveDelegatedAgentAiSettings(createToolConfig(), "explore");

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

    const result = await resolveDelegatedAgentAiSettings(createToolConfig(), "exec");

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
    mockResolveAgentInheritanceChain.mockResolvedValue([{ id: "desktop" }, { id: "exec" }]);
    mockResolveAgentFrontmatter.mockResolvedValue({
      name: "desktop",
      ai: {
        thinkingLevel: "medium",
      },
    });

    const result = await resolveDelegatedAgentAiSettings(createToolConfig(), "desktop");

    expect(result).toEqual({
      modelString: "anthropic:claude-sonnet-4-5",
      thinkingLevel: "medium",
    });
  });
});
