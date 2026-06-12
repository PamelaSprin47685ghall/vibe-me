import { describe, expect, test } from "bun:test";
import { getPluginToolPolicy } from "./agent-tool-policy.js";

const SAMPLE_TOOL_NAMES = [
  "bash",
  "bash_output",
  "browser",
  "editor",
  "executor",
  "file_edit_replace_string",
  "read",
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

  test("editor loses executor along with direct bash and other subagent tools", () => {
    const remove = removePatternsFor("editor");
    const enabled = enabledToolNamesFor("editor");

    expect(remove.has("executor")).toBe(true);
    expect(remove.has("bash")).toBe(true);
    expect(remove.has("bash_.*")).toBe(true);
    expect(remove.has("browser")).toBe(true);
    expect(remove.has("file_edit_.*")).toBe(false);
    expect(enabled.has("executor")).toBe(false);
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

describe("getPluginToolPolicy full remove lists per role", () => {
  const orchestratorRemove = [
    "bash",
    "bash_.*",
    "file_edit_.*",
    "fuzzy_find",
    "fuzzy_grep",
    "glob",
    "grep",
    "stealth_browser_mcp_.*",
    "submit_review_result",
    "task",
    "task_.*",
    "write",
  ].sort();

  test("orchestrator remove list", () => {
    const policy = getPluginToolPolicy("exec", "orchestrator");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(orchestratorRemove);
  });

  test("undefined role equals orchestrator", () => {
    const policy = getPluginToolPolicy("exec", undefined);
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(orchestratorRemove);
  });

  test("editor remove list", () => {
    const expected = [
      "ask_user_question",
      "bash",
      "bash_.*",
      "browser",
      "editor",
      "executor",
      "grep",
      "greper",
      "reverie",
      "stealth_browser_mcp_.*",
      "submit_review",
      "submit_review_result",
      "task",
      "task_.*",
      "todo_read",
      "todoread",
      "todo_write",
      "todowrite",
      "web_fetch",
      "web_search",
      "webfetch",
      "websearch",
    ].sort();
    const policy = getPluginToolPolicy("exec", "editor");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(expected);
  });

  test("greper remove list", () => {
    const expected = [
      "ask_user_question",
      "bash",
      "bash_.*",
      "browser",
      "editor",
      "file_edit_.*",
      "grep",
      "greper",
      "reverie",
      "stealth_browser_mcp_.*",
      "submit_review",
      "submit_review_result",
      "task",
      "task_.*",
      "todo_read",
      "todoread",
      "todo_write",
      "todowrite",
      "web_fetch",
      "web_search",
      "webfetch",
      "websearch",
      "write",
    ].sort();
    const policy = getPluginToolPolicy("exec", "greper");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(expected);
  });

  test("browser remove list", () => {
    const expected = [
      "ask_user_question",
      "bash",
      "bash_.*",
      "browser",
      "editor",
      "executor",
      "file_edit_.*",
      "fuzzy_find",
      "fuzzy_grep",
      "glob",
      "grep",
      "greper",
      "reverie",
      "submit_review",
      "submit_review_result",
      "task",
      "task_.*",
      "todo_read",
      "todoread",
      "todo_write",
      "todowrite",
      "web_fetch",
      "web_search",
      "webfetch",
      "websearch",
      "write",
    ].sort();
    const policy = getPluginToolPolicy("exec", "browser");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(expected);
  });

  test("reverie remove list", () => {
    const expected = [
      "ask_user_question",
      "bash",
      "bash_.*",
      "browser",
      "editor",
      "executor",
      "file_edit_.*",
      "fuzzy_find",
      "fuzzy_grep",
      "glob",
      "grep",
      "greper",
      "read",
      "reverie",
      "stealth_browser_mcp_.*",
      "submit_review",
      "submit_review_result",
      "task",
      "task_.*",
      "todo_read",
      "todoread",
      "todo_write",
      "todowrite",
      "web_fetch",
      "web_search",
      "webfetch",
      "websearch",
      "write",
    ].sort();
    const policy = getPluginToolPolicy("exec", "reverie");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(expected);
  });

  test("reviewer remove list (keeps submit_review_result)", () => {
    const expected = [
      "ask_user_question",
      "bash",
      "bash_.*",
      "browser",
      "editor",
      "executor",
      "file_edit_.*",
      "fuzzy_find",
      "fuzzy_grep",
      "glob",
      "grep",
      "greper",
      "reverie",
      "stealth_browser_mcp_.*",
      "submit_review",
      "task",
      "task_.*",
      "todo_read",
      "todoread",
      "todo_write",
      "todowrite",
      "web_fetch",
      "web_search",
      "webfetch",
      "websearch",
      "write",
    ].sort();
    const policy = getPluginToolPolicy("exec", "reviewer");
    expect(policy).toBeDefined();
    expect(policy!.add).toEqual([]);
    expect([...policy!.remove].sort()).toEqual(expected);
  });

  test("bogus role returns undefined", () => {
    const policy = getPluginToolPolicy("exec", "bogus");
    expect(policy).toBeUndefined();
  });
});
