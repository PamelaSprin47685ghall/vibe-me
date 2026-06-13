import { beforeEach, describe, expect, test } from 'vitest';
import { createMockDeps, createToolConfig } from "./resolveDelegatedAgentAiSettings.test-utils.js";

describe("resolveDelegatedAgentAiSettings for exec agent", () => {
  const { loadConfigOrDefault, resolve } = createMockDeps();

  beforeEach(() => {
    loadConfigOrDefault.mockReset();
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));
  });

  test("exec keeps direct subagent overrides", async () => {
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {
        exec: { modelString: "openai:gpt-5.2", thinkingLevel: "medium" },
      },
      subagentAiDefaults: {
        exec: { modelString: "openai:gpt-5.3-codex", thinkingLevel: "xhigh" },
      },
    }));

    const result = await resolve(createToolConfig(), "exec");

    expect(result).toEqual({
      modelString: "openai:gpt-5.3-codex",
      thinkingLevel: "xhigh",
    });
  });
});
