import { beforeEach, describe, expect, test } from 'vitest';
import { createMockDeps, createToolConfig } from "./resolveDelegatedAgentAiSettings.test-utils.js";

describe("resolveDelegatedAgentAiSettings for explore agent", () => {
  const { loadConfigOrDefault, resolve } = createMockDeps();

  beforeEach(() => {
    loadConfigOrDefault.mockReset();
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));
  });

  test("explore direct settings take priority over unrelated exec workspace settings", async () => {
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map([
        [
          "/repo",
          {
            workspaces: [
              {
                id: "ws-1",
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
        explore: {
          modelString: "anthropic:claude-explore",
          thinkingLevel: "medium",
        },
      },
    }));

    const result = await resolve(createToolConfig(), "explore");

    expect(result).toEqual({
      modelString: "anthropic:claude-explore",
      thinkingLevel: "medium",
    });
  });

  test("explore returns undefined when no direct explore settings exist", async () => {
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map([
        [
          "/repo",
          {
            workspaces: [
              {
                id: "ws-1",
                aiSettings: { model: "random:current-model", thinkingLevel: "low" },
                aiSettingsByAgent: {
                  exec: { model: "openai:gpt-5.3-codex", thinkingLevel: "xhigh" },
                },
              },
            ],
          },
        ],
      ]),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));

    const result = await resolve(createToolConfig(), "explore");

    expect(result).toEqual({
      modelString: undefined,
      thinkingLevel: undefined,
    });
  });

  test("explore does not fall back to generic workspace aiSettings when aiSettingsByAgent is absent", async () => {
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map([
        [
          "/repo",
          {
            workspaces: [
              {
                id: "ws-1",
                aiSettings: { model: "parent-model", thinkingLevel: "high" },
              },
            ],
          },
        ],
      ]),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));

    const result = await resolve(createToolConfig(), "explore");

    expect(result).toEqual({
      modelString: undefined,
      thinkingLevel: undefined,
    });
  });
});
