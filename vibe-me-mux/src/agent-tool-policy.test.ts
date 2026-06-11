import { describe, expect, test } from "bun:test";
import { getPluginToolPolicy } from "./agent-tool-policy.js";

const SAMPLE_TOOL_NAMES = [
  "bash",
  "bash_output",
  "browser",
  "editor",
  "file_edit_replace_string",
  "read",
  "runner",
  "stealth_browser_mcp_spawn_browser",
  "web_fetch",
  "websearch",
  "write",
] as const;

function removePatternsFor(role?: string): Set<string> {
  const policy = getPluginToolPolicy("exec", role);
  expect(policy).toBeDefined();
  return new Set(policy?.remove ?? []);
}

function enabledToolNamesFor(role?: string): Set<string> {
  const policy = getPluginToolPolicy("exec", role);
  expect(policy).toBeDefined();
  const enabled = new Map(SAMPLE_TOOL_NAMES.map((name) => [name, true]));

  for (const pattern of policy?.remove ?? []) {
    const regex = new RegExp(`^${pattern}$`);
    for (const toolName of SAMPLE_TOOL_NAMES) {
      if (regex.test(toolName)) enabled.set(toolName, false);
    }
  }

  return new Set(SAMPLE_TOOL_NAMES.filter((name) => enabled.get(name)));
}

describe("getPluginToolPolicy", () => {
  test("main session loses browser-only MCP tools", () => {
    const remove = removePatternsFor();
    const enabled = enabledToolNamesFor();

    expect(remove.has("stealth_browser_mcp_.*")).toBe(true);
    expect(remove.has("stealth_browser_mcp_star")).toBe(false);
    expect(enabled.has("stealth_browser_mcp_spawn_browser")).toBe(false);
  });

  test("browser keeps browser-only MCP tools", () => {
    const enabled = enabledToolNamesFor("browser");

    expect(removePatternsFor("browser").has("stealth_browser_mcp_.*")).toBe(false);
    expect(enabled.has("stealth_browser_mcp_spawn_browser")).toBe(true);
    expect(enabled.has("bash")).toBe(false);
  });

  test("editor loses runner along with direct bash and other subagent tools", () => {
    const remove = removePatternsFor("editor");
    const enabled = enabledToolNamesFor("editor");

    expect(remove.has("runner")).toBe(true);
    expect(remove.has("bash")).toBe(true);
    expect(remove.has("bash_.*")).toBe(true);
    expect(remove.has("browser")).toBe(true);
    expect(remove.has("file_edit_.*")).toBe(false);
    expect(enabled.has("runner")).toBe(false);
    expect(enabled.has("bash")).toBe(false);
    expect(enabled.has("bash_output")).toBe(false);
    expect(enabled.has("file_edit_replace_string")).toBe(true);
  });

  test("orchestrator cannot mutate files directly", () => {
    const remove = removePatternsFor();
    const enabled = enabledToolNamesFor();

    expect(remove.has("write")).toBe(true);
    expect(remove.has("file_edit_.*")).toBe(true);
    expect(enabled.has("write")).toBe(false);
    expect(enabled.has("file_edit_replace_string")).toBe(false);
  });
});
