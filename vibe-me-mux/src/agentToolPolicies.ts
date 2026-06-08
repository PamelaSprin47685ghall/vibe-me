import { AGENT_POLICIES } from "engine/agent-policy";
import type { AgentToolPolicy } from "./types/tool.js";

export type { AgentToolPolicy };

export type MuxAgentName = "exec" | "explore";

export type SubAgentRole = "editor" | "greper" | "runner" | "browser" | "reverie" | "reviewer";

export type MuxAgentToolPolicies = Record<MuxAgentName, {
  main: AgentToolPolicy;
} & Partial<Record<SubAgentRole, AgentToolPolicy>>>;

// ── Tool name regex patterns (bare names — wrapped with ^...$ by applyToolPolicyToNames) ──

const BASH = "bash";
const GREP = "grep";
const EDITOR = "editor";
const WRITE = "write";
const RUNNER = "runner";
const RUNNER_WAIT = "runner_wait";
const RUNNER_ABORT = "runner_abort";
const BROWSER = "browser";
const SUBMIT_REVIEW = "submit_review";

const START_REVIEW_LOOP = "start_review_loop";
const GREPER = "greper";
const REVERIE = "reverie";
const WEBSEARCH = "websearch";
const WEBFETCH = "webfetch";
const FUZZY_GREP = "fuzzy_grep";
const FUZZY_FIND = "fuzzy_find";
const FILE_READ = "read";
const GLOB = "glob";
const TODO_READ = "todo_read";
const TODO_WRITE = "todo_write";
const PROPOSE_PLAN = "propose_plan";
const ASK_USER_QUESTION = "ask_user_question";
const WEB_FETCH = "web_fetch";
const WEB_SEARCH = "web_search";
const TASK = "task";
const FILE_EDIT_REPLACE_STRING = "file_edit_replace_string";
const FILE_EDIT_INSERT = "file_edit_insert";
const ATTACH_FILE = "attach_file";

// Miscellaneous tool names
const ADVISOR = "advisor";
const NOTIFY = "notify";

const ANALYTICS_QUERY = "analytics_query";
const GET_GOAL = "get_goal";
const COMPLETE_GOAL = "complete_goal";
const REVIEW_PANE_UPDATE = "review_pane_update";
const REVIEW_PANE_GET = "review_pane_get";

// Family prefix patterns (match any tool name starting with the prefix)
const STEALTH_FAMILY = "stealth_browser_mcp_.*";
const DESKTOP_FAMILY = "desktop_.*";

// ── Composite groups ──

const MUTATION_TOOLS: readonly string[] = [
  WRITE,
  FILE_EDIT_REPLACE_STRING,
  FILE_EDIT_INSERT,
  ATTACH_FILE,
];

const EXECUTION_TOOLS: readonly string[] = [RUNNER, RUNNER_WAIT, RUNNER_ABORT];

const WEB_TOOLS: readonly string[] = [
  WEB_FETCH,
  WEB_SEARCH,
  WEBSEARCH,
  WEBFETCH,
];

const FUZZY_TOOLS: readonly string[] = [FUZZY_FIND, FUZZY_GREP];

const DELEGATION_TOOLS: readonly string[] = [
  EDITOR,
  GREPER,
  REVERIE,
  BROWSER,
  SUBMIT_REVIEW,
  START_REVIEW_LOOP,
];

const ORCHESTRATION_TOOLS: readonly string[] = [
  ASK_USER_QUESTION,
  PROPOSE_PLAN,
  TODO_READ,
  TODO_WRITE,
  ADVISOR,
  NOTIFY,
  GET_GOAL,
  COMPLETE_GOAL,
  REVIEW_PANE_UPDATE,
  REVIEW_PANE_GET,
];

const DESKTOP_INTERACTION_TOOLS: readonly string[] = [
  ANALYTICS_QUERY,
  "desktop_screenshot",
  "desktop_move_mouse",
  "desktop_click",
  "desktop_double_click",
  "desktop_drag",
  "desktop_scroll",
  "desktop_type",
  "desktop_key_press",
];

const MUX_ADMIN_TOOLS: readonly string[] = [
  "agent_skill_read",
  "agent_skill_read_file",
  "agent_skill_list",
  "agent_skill_write",
  "agent_skill_delete",
  "skills_catalog_search",
  "skills_catalog_read",
  "mux_agents_read",
  "mux_agents_write",
  "mux_config_read",
  "mux_config_write",
];

// ── Sub-agent disabled tool lists ──
// Defense-in-depth: disabledTools is applied AFTER per-role policy resolution.
// The per-role pluginPolicies already restrict tool visibility; disabledTools
// is the final safety net that overrides everything and prevents recursion.

export const EDITOR_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.editor.disabledTools;

export const GREPER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.greper.disabledTools;

export const RUNNER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  RUNNER,
  FILE_READ,
  FILE_EDIT_REPLACE_STRING,
  FILE_EDIT_INSERT,
  WRITE,
  ATTACH_FILE,
  GLOB,
  ...FUZZY_TOOLS,
  ...DELEGATION_TOOLS,
  ...WEB_TOOLS,
  ...ORCHESTRATION_TOOLS,
  BASH,
  "bash_output",
  "bash_background_list",
  "bash_background_terminate",
  ...DESKTOP_INTERACTION_TOOLS,
  ...MUX_ADMIN_TOOLS,
];

export const BROWSER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.browser.disabledTools;

export const REVERIE_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reverie.disabledTools;

export const REVIEWER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reviewer.disabledTools;

// ── Builder ──

export function buildAgentToolPolicies(): MuxAgentToolPolicies {
  return {
    // exec = OpenCode orchestrator (main) + editor + runner sub-agents.
    exec: {
      // Main = strict OpenCode orchestrator. Delegates mutations, but can use
      // runner directly. No bash, no grep, no fuzzy tools, no stealth browser,
      // no task lifecycle, no runner wait/abort.
      main: {
        add: [
          FILE_READ,
          GREPER,
          REVERIE,
          SUBMIT_REVIEW,
          START_REVIEW_LOOP,
          ...WEB_TOOLS,
          BROWSER,
          GLOB,
          ASK_USER_QUESTION,
          PROPOSE_PLAN,
          TODO_READ,
          TODO_WRITE,
          FUZZY_FIND,
          EDITOR,
        ],
        remove: [
          BASH,
          GREP,
          FUZZY_GREP,
          STEALTH_FAMILY,
          TASK,
          RUNNER_WAIT,
          RUNNER_ABORT,
          WRITE,
          FILE_EDIT_REPLACE_STRING,
          FILE_EDIT_INSERT,
          ATTACH_FILE,
        ],
      },

      // editor = OpenCode editor agent. Can mutate files but cannot delegate
      // further, cannot run executables, cannot manage task lifecycle.
      editor: {
        add: [
          FILE_READ,
          ...MUTATION_TOOLS,
          GLOB,
          TODO_READ,
          TODO_WRITE,
        ],
        remove: [
          BASH,
          GREP,
          ...FUZZY_TOOLS,
          STEALTH_FAMILY,
          TASK,
          ...DELEGATION_TOOLS,
          ...EXECUTION_TOOLS,
          ...WEB_TOOLS,
          PROPOSE_PLAN,
          ASK_USER_QUESTION,
          FILE_EDIT_INSERT,
        ],
      },
    },

    // explore = read-only sub-agent (main) + greper + browser + reverie + reviewer.
    explore: {
      // Main = the explore policy (read-only sub-agent).
      main: {
        add: [
          FILE_READ,
          GLOB,
          GREPER,
          ...FUZZY_TOOLS,
          RUNNER,
          BROWSER,
          STEALTH_FAMILY,
        ],
        remove: [
          BASH,
          GREP,
          ...MUTATION_TOOLS,
          REVERIE,
          SUBMIT_REVIEW,
          START_REVIEW_LOOP,
          RUNNER_WAIT,
          RUNNER_ABORT,
          ...WEB_TOOLS,
          TASK,
          DESKTOP_FAMILY,
          PROPOSE_PLAN,
          TODO_READ,
          TODO_WRITE,
          ASK_USER_QUESTION,
        ],
      },

      // greper = OpenCode greper. Like explore but no delegation, no runner wait/abort.
      greper: {
        add: [
          FILE_READ,
          GLOB,
          ...FUZZY_TOOLS,
          RUNNER,
        ],
        remove: [
          BASH,
          GREP,
          ...MUTATION_TOOLS,
          GREPER,
          REVERIE,
          BROWSER,
          SUBMIT_REVIEW,
          START_REVIEW_LOOP,
          RUNNER_WAIT,
          RUNNER_ABORT,
          ...WEB_TOOLS,
          TASK,
          DESKTOP_FAMILY,
          STEALTH_FAMILY,
          PROPOSE_PLAN,
          TODO_READ,
          TODO_WRITE,
          ASK_USER_QUESTION,
        ],
      },

      // browser = OpenCode browser. Can ONLY use read + stealth_browser_mcp_*.
      browser: {
        add: [
          FILE_READ,
          STEALTH_FAMILY,
        ],
        remove: [
          BASH,
          GREP,
          ...FUZZY_TOOLS,
          DESKTOP_FAMILY,
          TASK,
          ...MUTATION_TOOLS,
          ...DELEGATION_TOOLS,
          ...EXECUTION_TOOLS,
          ...WEB_TOOLS,
          ...ORCHESTRATION_TOOLS,
          ...DESKTOP_INTERACTION_TOOLS,
          ...MUX_ADMIN_TOOLS,
          GLOB,
          GREPER,
        ],
      },

      // reverie = OpenCode reverie. Can use NOTHING. Empty add + broad remove.
      reverie: {
        add: [],
        remove: [
          BASH,
          GREP,
          ...FUZZY_TOOLS,
          STEALTH_FAMILY,
          DESKTOP_FAMILY,
          TASK,
          ...MUTATION_TOOLS,
          ...DELEGATION_TOOLS,
          ...EXECUTION_TOOLS,
          ...WEB_TOOLS,
          ...ORCHESTRATION_TOOLS,
          ...DESKTOP_INTERACTION_TOOLS,
          ...MUX_ADMIN_TOOLS,
          FILE_READ,
          GLOB,
          GREPER,
        ],
      },

      // reviewer = OpenCode reviewer. Can use read + glob only.
      reviewer: {
        add: [
          FILE_READ,
          GLOB,
        ],
        remove: [
          BASH,
          GREP,
          ...FUZZY_TOOLS,
          STEALTH_FAMILY,
          DESKTOP_FAMILY,
          TASK,
          ...MUTATION_TOOLS,
          ...DELEGATION_TOOLS,
          ...EXECUTION_TOOLS,
          ...WEB_TOOLS,
          ...ORCHESTRATION_TOOLS,
          ...DESKTOP_INTERACTION_TOOLS,
          ...MUX_ADMIN_TOOLS,
          GREPER,
        ],
      },
      // runner = read-only runner agent. Can ONLY use runner_wait + runner_abort.
      // Strictest possible policy: nothing else is allowed.
      runner: {
        add: [RUNNER_WAIT, RUNNER_ABORT],
        remove: [
          BASH,
          GREP,
          ...FUZZY_TOOLS,
          STEALTH_FAMILY,
          DESKTOP_FAMILY,
          TASK,
          ...MUTATION_TOOLS,
          ...DELEGATION_TOOLS,
          RUNNER,
          ...WEB_TOOLS,
          ...ORCHESTRATION_TOOLS,
          ...DESKTOP_INTERACTION_TOOLS,
          ...MUX_ADMIN_TOOLS,
        ],
      },
    },
  };
}

// ── Lookup ──

export function getPluginToolPolicy(
  agentId: string,
  role?: string,
): AgentToolPolicy | undefined {
  const policies = buildAgentToolPolicies()[agentId as MuxAgentName];
  if (!policies) return undefined;
  if (role && role in policies) return policies[role as SubAgentRole];
  return policies.main;
}
