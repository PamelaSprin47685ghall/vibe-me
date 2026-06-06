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
