import type { AgentToolPolicy } from "./types/tool.js";

export type { AgentToolPolicy };

export type MuxAgentName = "exec" | "explore";

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
const SUBMIT_REVIEW_RESULT = "submit_review_result";
const START_REVIEW_LOOP = "start_review_loop";
const GREPER = "greper";
const REVERIE = "reverie";
const WEBSEARCH = "websearch";
const WEBFETCH = "webfetch";
const FUZZY_GREP = "fuzzy_grep";
const FUZZY_FIND = "fuzzy_find";
const FILE_READ = "file_read";
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

// Task lifecycle tool names
const TASK_AWAIT = "task_await";
const TASK_LIST = "task_list";
const TASK_TERMINATE = "task_terminate";
const TASK_APPLY_GIT_PATCH = "task_apply_git_patch";

// Miscellaneous tool names
const ADVISOR = "advisor";
const NOTIFY = "notify";
const AGENT_REPORT = "agent_report";
const ANALYTICS_QUERY = "analytics_query";
const GET_GOAL = "get_goal";
const COMPLETE_GOAL = "complete_goal";
const REVIEW_PANE_UPDATE = "review_pane_update";
const REVIEW_PANE_GET = "review_pane_get";

// Family prefix patterns (match any tool name starting with the prefix)
const STEALTH_FAMILY = "stealth_browser_mcp_.*";
const DESKTOP_FAMILY = "desktop_.*";
const TASK_FAMILY = "task_.*";

// ── Composite groups ──

const MUTATION_TOOLS: readonly string[] = [
  EDITOR,
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

const TASK_LIFECYCLE_TOOLS: readonly string[] = [
  TASK,
  TASK_AWAIT,
  TASK_LIST,
  TASK_TERMINATE,
  TASK_APPLY_GIT_PATCH,
];

const ORCHESTRATION_TOOLS: readonly string[] = [
  ASK_USER_QUESTION,
  PROPOSE_PLAN,
  TODO_READ,
  TODO_WRITE,
  ADVISOR,
  NOTIFY,
  AGENT_REPORT,
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

export const EDITOR_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  ...DELEGATION_TOOLS,
  ...EXECUTION_TOOLS,
  ...TASK_LIFECYCLE_TOOLS,
];

export const GREPER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  GREPER,
  REVERIE,
  BROWSER,
  SUBMIT_REVIEW,
  START_REVIEW_LOOP,
  RUNNER_WAIT,
  RUNNER_ABORT,
];

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
  SUBMIT_REVIEW_RESULT,
  ...EXECUTION_TOOLS,
  ...WEB_TOOLS,
  ...ORCHESTRATION_TOOLS,
  ...TASK_LIFECYCLE_TOOLS,
  BASH,
  "bash_output",
  "bash_background_list",
  "bash_background_terminate",
  ...DESKTOP_INTERACTION_TOOLS,
  ...MUX_ADMIN_TOOLS,
];

export const BROWSER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  GLOB,
  GREPER,
  ...FUZZY_TOOLS,
  RUNNER,
  BROWSER,
  SUBMIT_REVIEW_RESULT,
  ...DELEGATION_TOOLS,
  ...MUTATION_TOOLS,
  ...EXECUTION_TOOLS,
  ...WEB_TOOLS,
  ...ORCHESTRATION_TOOLS,
  ...TASK_LIFECYCLE_TOOLS,
  ...DESKTOP_INTERACTION_TOOLS,
  ...MUX_ADMIN_TOOLS,
  BASH,
  "bash_output",
  "bash_background_list",
  "bash_background_terminate",
  GREP,
];

export const REVERIE_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  REVERIE,
  GREPER,
  EDITOR,
  BROWSER,
  SUBMIT_REVIEW,
  START_REVIEW_LOOP,
  RUNNER,
  RUNNER_WAIT,
  RUNNER_ABORT,
];

export const REVIEWER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = [
  SUBMIT_REVIEW,
  EDITOR,
  GREPER,
  REVERIE,
  BROWSER,
  START_REVIEW_LOOP,
  RUNNER,
  RUNNER_WAIT,
  RUNNER_ABORT,
];

// ── Builder ──

export function buildAgentToolPolicies(): Record<MuxAgentName, AgentToolPolicy> {
  return {
    // exec = OpenCode orchestrator + editor + runner (main agent)
    exec: {
      add: [
        FILE_READ,
        ...MUTATION_TOOLS,
        GREPER,
        REVERIE,
        SUBMIT_REVIEW,
        START_REVIEW_LOOP,
        ...WEB_TOOLS,
        ...EXECUTION_TOOLS,
        BROWSER,
        GLOB,
        ...FUZZY_TOOLS,
        ASK_USER_QUESTION,
        PROPOSE_PLAN,
        TODO_READ,
        TODO_WRITE,
      ],
      remove: [
        BASH,
        GREP,
        STEALTH_FAMILY,
        TASK,
        TASK_FAMILY,
        SUBMIT_REVIEW_RESULT,
      ],
    },

    // explore = OpenCode reviewer + greper + browser + reverie (read-only sub-agent)
    explore: {
      add: [
        FILE_READ,
        GLOB,
        GREPER,
        ...FUZZY_TOOLS,
        RUNNER,
        BROWSER,
        STEALTH_FAMILY,
        SUBMIT_REVIEW_RESULT,
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
        TASK_FAMILY,
        DESKTOP_FAMILY,
        PROPOSE_PLAN,
        TODO_READ,
        TODO_WRITE,
        ASK_USER_QUESTION,
      ],
    },
  };
}
