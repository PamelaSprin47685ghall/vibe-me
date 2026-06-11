import {
  getAgentTools,
  computeDefaultPermissions,
  agentRoleFromString,
} from "engine/agent-policy";

export interface MuxPluginToolPolicy {
  add: string[];
  remove: string[];
}

export type MuxAgentName = "exec" | "explore";
export type SubAgentRole = "editor" | "greper" | "runner" | "browser" | "reverie" | "reviewer";

const MUX_TOOL_PATTERNS_BY_POLICY_NAME: Record<string, readonly string[]> = {
  read: ["read"],
  write: ["write"],
  edit: ["file_edit_.*"],
  runner: ["runner"],
  glob: ["glob"],
  fuzzy_find: ["fuzzy_find"],
  fuzzy_grep: ["fuzzy_grep"],
  grep: ["grep"],
  editor: ["editor"],
  greper: ["greper"],
  reverie: ["reverie"],
  submit_review: ["submit_review"],
  submit_review_result: ["submit_review_result"],
  webfetch: ["webfetch", "web_fetch"],
  websearch: ["websearch", "web_search"],
  browser: ["browser"],
  task: ["task", "task_.*"],
  runner_wait: ["runner_wait"],
  runner_abort: ["runner_abort"],
  stealth_browser_mcp_star: ["stealth_browser_mcp_.*"],
  "stealth-browser-mcp_star": ["stealth_browser_mcp_.*"],
  bash: ["bash", "bash_.*"],
  question: ["ask_user_question"],
};

function expandMuxToolPatterns(names: Iterable<string>): string[] {
  const patterns = new Set<string>();
  for (const name of names) {
    for (const pattern of MUX_TOOL_PATTERNS_BY_POLICY_NAME[name] ?? [name]) {
      patterns.add(pattern);
    }
  }
  return [...patterns];
}

export function getPluginToolPolicy(
  _agentId: string,
  role?: string,
): MuxPluginToolPolicy | undefined {
  const roleResult = agentRoleFromString(role || "orchestrator");
  if (roleResult._tag === "Err") return undefined;

  const toolMap = getAgentTools(roleResult.value);
  const permMap = computeDefaultPermissions(roleResult.value);

  const disabledToolNames = [...toolMap.entries()]
    .filter(([, p]) => p._tag === 'Deny')
    .map(([n]) => n);

  const deniedPermissionNames = [...permMap.entries()]
    .filter(([, p]) => p._tag === 'Deny')
    .map(([n]) => n);

  return {
    add: [],
    remove: expandMuxToolPatterns([
      ...disabledToolNames,
      ...deniedPermissionNames,
    ]),
  };
}
