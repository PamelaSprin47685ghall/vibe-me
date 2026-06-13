import { beforeEach, describe, expect, test } from 'vitest';
import { createMockDeps, createToolConfig } from "./resolveDelegatedAgentAiSettings.test-utils.js";

describe("resolveDelegatedAgentAiSettings for desktop agent", () => {
  const { loadConfigOrDefault, resolveAgentFrontmatter, resolve } =
    createMockDeps();

  beforeEach(() => {
    loadConfigOrDefault.mockReset();
    resolveAgentFrontmatter.mockReset();

    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {},
      subagentAiDefaults: {},
    }));
    resolveAgentFrontmatter.mockResolvedValue({ name: "" });
  });

  test("desktop only uses its own descriptor settings, no inheritance from exec", async () => {
    loadConfigOrDefault.mockImplementation(() => ({
      projects: new Map(),
      agentAiDefaults: {
        exec: { modelString: "anthropic:claude-sonnet-4-5" },
      },
      subagentAiDefaults: {},
    }));
    resolveAgentFrontmatter.mockResolvedValue({
      name: "desktop",
      ai: { thinkingLevel: "medium" },
    });

    const result = await resolve(createToolConfig(), "desktop");

    expect(result).toEqual({
      modelString: undefined,
      thinkingLevel: "medium",
    });
  });
});
