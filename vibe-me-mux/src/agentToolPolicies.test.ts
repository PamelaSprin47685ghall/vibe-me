import { describe, expect, test } from "bun:test";
import {
  getPluginToolPolicy,
  RUNNER_SUB_AGENT_DISABLED_TOOLS,
} from "./agentToolPolicies.js";

describe("agent tool policies", () => {
  test("returns main policy by default and for unknown roles", () => {
    const execMainPolicy = getPluginToolPolicy("exec");

    expect(getPluginToolPolicy("missing")).toBeUndefined();
    expect(getPluginToolPolicy("exec", "missing")).toEqual(execMainPolicy);
    expect(execMainPolicy?.add).toContain("editor");
    expect(execMainPolicy?.remove).toContain("runner_wait");
  });

  test("keeps runner plugin policy limited to wait and abort controls", () => {
    const runnerPolicy = getPluginToolPolicy("explore", "runner");

    expect(runnerPolicy?.add).toEqual(["runner_wait", "runner_abort"]);
    expect(runnerPolicy?.remove).toContain("runner");
    expect(runnerPolicy?.remove).toContain("bash");
    expect(runnerPolicy?.remove).not.toContain("runner_wait");
    expect(runnerPolicy?.remove).not.toContain("runner_abort");
  });

  test("keeps runner disabled tools broad without disabling wait and abort", () => {
    expect(RUNNER_SUB_AGENT_DISABLED_TOOLS).toEqual(expect.arrayContaining([
      "runner",
      "read",
      "file_edit_replace_string",
      "file_edit_insert",
      "write",
      "attach_file",
      "editor",
      "greper",
      "browser",
      "submit_review",
      "web_fetch",
      "web_search",
      "websearch",
      "webfetch",
      "ask_user_question",
      "propose_plan",
      "todo_read",
      "todo_write",
      "bash",
      "bash_output",
      "bash_background_list",
      "bash_background_terminate",
      "desktop_screenshot",
      "desktop_click",
      "agent_skill_read",
      "mux_config_write",
    ]));
    expect(RUNNER_SUB_AGENT_DISABLED_TOOLS).not.toContain("runner_wait");
    expect(RUNNER_SUB_AGENT_DISABLED_TOOLS).not.toContain("runner_abort");
  });
});
