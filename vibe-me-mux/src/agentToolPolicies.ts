import { AGENT_POLICIES } from "engine/agent-policy";
import type { MuxPluginToolPolicy } from "./types/tool.js";

export type { MuxPluginToolPolicy };

export type MuxAgentName = "exec" | "explore";

export type SubAgentRole = "editor" | "greper" | "runner" | "browser" | "reverie" | "reviewer";

export type MuxAgentToolPolicies = Record<MuxAgentName, {
  main: MuxPluginToolPolicy;
} & Partial<Record<SubAgentRole, MuxPluginToolPolicy>>>;

const TOOL_NAME = {
  bash: "bash",
  bashOutput: "bash_output",
  bashBackgroundList: "bash_background_list",
  bashBackgroundTerminate: "bash_background_terminate",
  grep: "grep",
  editor: "editor",
  write: "write",
  runner: "runner",
  runnerWait: "runner_wait",
  runnerAbort: "runner_abort",
  browser: "browser",
  submitReview: "submit_review",
  startReviewLoop: "start_review_loop",
  greper: "greper",
  reverie: "reverie",
  websearch: "websearch",
  webfetch: "webfetch",
  fuzzyGrep: "fuzzy_grep",
  fuzzyFind: "fuzzy_find",
  fileRead: "read",
  glob: "glob",
  todoRead: "todo_read",
  todoWrite: "todo_write",
  proposePlan: "propose_plan",
  askUserQuestion: "ask_user_question",
  webFetch: "web_fetch",
  webSearch: "web_search",
  task: "task",
  fileEditReplaceString: "file_edit_replace_string",
  fileEditInsert: "file_edit_insert",
  attachFile: "attach_file",
  advisor: "advisor",
  notify: "notify",
  analyticsQuery: "analytics_query",
  getGoal: "get_goal",
  completeGoal: "complete_goal",
  reviewPaneUpdate: "review_pane_update",
  reviewPaneGet: "review_pane_get",
  desktopScreenshot: "desktop_screenshot",
  desktopMoveMouse: "desktop_move_mouse",
  desktopClick: "desktop_click",
  desktopDoubleClick: "desktop_double_click",
  desktopDrag: "desktop_drag",
  desktopScroll: "desktop_scroll",
  desktopType: "desktop_type",
  desktopKeyPress: "desktop_key_press",
  agentSkillRead: "agent_skill_read",
  agentSkillReadFile: "agent_skill_read_file",
  agentSkillList: "agent_skill_list",
  agentSkillWrite: "agent_skill_write",
  agentSkillDelete: "agent_skill_delete",
  skillsCatalogSearch: "skills_catalog_search",
  skillsCatalogRead: "skills_catalog_read",
  muxAgentsRead: "mux_agents_read",
  muxAgentsWrite: "mux_agents_write",
  muxConfigRead: "mux_config_read",
  muxConfigWrite: "mux_config_write",
} as const;

const TOOL_PATTERN = {
  stealthBrowserMcpFamily: "stealth_browser_mcp_.*",
  desktopFamily: "desktop_.*",
} as const;

type ToolSelector = string | readonly string[];

const selectTools = (...selectors: readonly ToolSelector[]): string[] => selectors.flatMap((selector) => (
  typeof selector === "string" ? [selector] : [...selector]
));

function toolPolicy(
  addSelectors: readonly ToolSelector[],
  removeSelectors: readonly ToolSelector[],
): MuxPluginToolPolicy {
  return {
    add: selectTools(...addSelectors),
    remove: selectTools(...removeSelectors),
  };
}

const MUTATION_TOOLS: readonly string[] = [
  TOOL_NAME.write,
  TOOL_NAME.fileEditReplaceString,
  TOOL_NAME.fileEditInsert,
  TOOL_NAME.attachFile,
];

const EXECUTION_TOOLS: readonly string[] = [
  TOOL_NAME.runner,
  TOOL_NAME.runnerWait,
  TOOL_NAME.runnerAbort,
];

const WEB_TOOLS: readonly string[] = [
  TOOL_NAME.webFetch,
  TOOL_NAME.webSearch,
  TOOL_NAME.websearch,
  TOOL_NAME.webfetch,
];

const FUZZY_TOOLS: readonly string[] = [TOOL_NAME.fuzzyFind, TOOL_NAME.fuzzyGrep];

const DELEGATION_TOOLS: readonly string[] = [
  TOOL_NAME.editor,
  TOOL_NAME.greper,
  TOOL_NAME.reverie,
  TOOL_NAME.browser,
  TOOL_NAME.submitReview,
  TOOL_NAME.startReviewLoop,
];

const ORCHESTRATION_TOOLS: readonly string[] = [
  TOOL_NAME.askUserQuestion,
  TOOL_NAME.proposePlan,
  TOOL_NAME.todoRead,
  TOOL_NAME.todoWrite,
  TOOL_NAME.advisor,
  TOOL_NAME.notify,
  TOOL_NAME.getGoal,
  TOOL_NAME.completeGoal,
  TOOL_NAME.reviewPaneUpdate,
  TOOL_NAME.reviewPaneGet,
];

const BASH_FAMILY_TOOLS: readonly string[] = [
  TOOL_NAME.bash,
  TOOL_NAME.bashOutput,
  TOOL_NAME.bashBackgroundList,
  TOOL_NAME.bashBackgroundTerminate,
];

const DESKTOP_INTERACTION_TOOLS: readonly string[] = [
  TOOL_NAME.analyticsQuery,
  TOOL_NAME.desktopScreenshot,
  TOOL_NAME.desktopMoveMouse,
  TOOL_NAME.desktopClick,
  TOOL_NAME.desktopDoubleClick,
  TOOL_NAME.desktopDrag,
  TOOL_NAME.desktopScroll,
  TOOL_NAME.desktopType,
  TOOL_NAME.desktopKeyPress,
];

const MUX_ADMIN_TOOLS: readonly string[] = [
  TOOL_NAME.agentSkillRead,
  TOOL_NAME.agentSkillReadFile,
  TOOL_NAME.agentSkillList,
  TOOL_NAME.agentSkillWrite,
  TOOL_NAME.agentSkillDelete,
  TOOL_NAME.skillsCatalogSearch,
  TOOL_NAME.skillsCatalogRead,
  TOOL_NAME.muxAgentsRead,
  TOOL_NAME.muxAgentsWrite,
  TOOL_NAME.muxConfigRead,
  TOOL_NAME.muxConfigWrite,
];

const RUNNER_DISABLED_FILE_TOOLS: readonly string[] = [
  TOOL_NAME.fileRead,
  TOOL_NAME.fileEditReplaceString,
  TOOL_NAME.fileEditInsert,
  TOOL_NAME.write,
  TOOL_NAME.attachFile,
];

export const EDITOR_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.editor.disabledTools;

export const GREPER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.greper.disabledTools;

export const RUNNER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = selectTools(
  TOOL_NAME.runner,
  RUNNER_DISABLED_FILE_TOOLS,
  TOOL_NAME.glob,
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
  WEB_TOOLS,
  ORCHESTRATION_TOOLS,
  BASH_FAMILY_TOOLS,
  DESKTOP_INTERACTION_TOOLS,
  MUX_ADMIN_TOOLS,
);

export const BROWSER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.browser.disabledTools;

export const REVERIE_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reverie.disabledTools;

export const REVIEWER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reviewer.disabledTools;

export function buildAgentToolPolicies(): MuxAgentToolPolicies {
  return {
    exec: {
      main: toolPolicy(
        [
          TOOL_NAME.fileRead,
          TOOL_NAME.greper,
          TOOL_NAME.reverie,
          TOOL_NAME.submitReview,
          TOOL_NAME.startReviewLoop,
          WEB_TOOLS,
          TOOL_NAME.browser,
          TOOL_NAME.glob,
          TOOL_NAME.askUserQuestion,
          TOOL_NAME.proposePlan,
          TOOL_NAME.todoRead,
          TOOL_NAME.todoWrite,
          TOOL_NAME.fuzzyFind,
          TOOL_NAME.editor,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          TOOL_NAME.fuzzyGrep,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_NAME.task,
          TOOL_NAME.runnerWait,
          TOOL_NAME.runnerAbort,
          TOOL_NAME.write,
          TOOL_NAME.fileEditReplaceString,
          TOOL_NAME.fileEditInsert,
          TOOL_NAME.attachFile,
        ],
      ),
      editor: toolPolicy(
        [
          TOOL_NAME.fileRead,
          MUTATION_TOOLS,
          TOOL_NAME.glob,
          TOOL_NAME.todoRead,
          TOOL_NAME.todoWrite,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          FUZZY_TOOLS,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_NAME.task,
          DELEGATION_TOOLS,
          EXECUTION_TOOLS,
          WEB_TOOLS,
          TOOL_NAME.proposePlan,
          TOOL_NAME.askUserQuestion,
          TOOL_NAME.fileEditInsert,
        ],
      ),
    },
    explore: {
      main: toolPolicy(
        [
          TOOL_NAME.fileRead,
          TOOL_NAME.glob,
          TOOL_NAME.greper,
          FUZZY_TOOLS,
          TOOL_NAME.runner,
          TOOL_NAME.browser,
          TOOL_PATTERN.stealthBrowserMcpFamily,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          MUTATION_TOOLS,
          TOOL_NAME.reverie,
          TOOL_NAME.submitReview,
          TOOL_NAME.startReviewLoop,
          TOOL_NAME.runnerWait,
          TOOL_NAME.runnerAbort,
          WEB_TOOLS,
          TOOL_NAME.task,
          TOOL_PATTERN.desktopFamily,
          TOOL_NAME.proposePlan,
          TOOL_NAME.todoRead,
          TOOL_NAME.todoWrite,
          TOOL_NAME.askUserQuestion,
        ],
      ),
      greper: toolPolicy(
        [
          TOOL_NAME.fileRead,
          TOOL_NAME.glob,
          FUZZY_TOOLS,
          TOOL_NAME.runner,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          MUTATION_TOOLS,
          TOOL_NAME.greper,
          TOOL_NAME.reverie,
          TOOL_NAME.browser,
          TOOL_NAME.submitReview,
          TOOL_NAME.startReviewLoop,
          TOOL_NAME.runnerWait,
          TOOL_NAME.runnerAbort,
          WEB_TOOLS,
          TOOL_NAME.task,
          TOOL_PATTERN.desktopFamily,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_NAME.proposePlan,
          TOOL_NAME.todoRead,
          TOOL_NAME.todoWrite,
          TOOL_NAME.askUserQuestion,
        ],
      ),
      browser: toolPolicy(
        [
          TOOL_NAME.fileRead,
          TOOL_PATTERN.stealthBrowserMcpFamily,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          FUZZY_TOOLS,
          TOOL_PATTERN.desktopFamily,
          TOOL_NAME.task,
          MUTATION_TOOLS,
          DELEGATION_TOOLS,
          EXECUTION_TOOLS,
          WEB_TOOLS,
          ORCHESTRATION_TOOLS,
          DESKTOP_INTERACTION_TOOLS,
          MUX_ADMIN_TOOLS,
          TOOL_NAME.glob,
          TOOL_NAME.greper,
        ],
      ),
      reverie: toolPolicy(
        [],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          FUZZY_TOOLS,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_PATTERN.desktopFamily,
          TOOL_NAME.task,
          MUTATION_TOOLS,
          DELEGATION_TOOLS,
          EXECUTION_TOOLS,
          WEB_TOOLS,
          ORCHESTRATION_TOOLS,
          DESKTOP_INTERACTION_TOOLS,
          MUX_ADMIN_TOOLS,
          TOOL_NAME.fileRead,
          TOOL_NAME.glob,
          TOOL_NAME.greper,
        ],
      ),
      reviewer: toolPolicy(
        [
          TOOL_NAME.fileRead,
          TOOL_NAME.glob,
        ],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          FUZZY_TOOLS,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_PATTERN.desktopFamily,
          TOOL_NAME.task,
          MUTATION_TOOLS,
          DELEGATION_TOOLS,
          EXECUTION_TOOLS,
          WEB_TOOLS,
          ORCHESTRATION_TOOLS,
          DESKTOP_INTERACTION_TOOLS,
          MUX_ADMIN_TOOLS,
          TOOL_NAME.greper,
        ],
      ),
      runner: toolPolicy(
        [TOOL_NAME.runnerWait, TOOL_NAME.runnerAbort],
        [
          TOOL_NAME.bash,
          TOOL_NAME.grep,
          FUZZY_TOOLS,
          TOOL_PATTERN.stealthBrowserMcpFamily,
          TOOL_PATTERN.desktopFamily,
          TOOL_NAME.task,
          MUTATION_TOOLS,
          DELEGATION_TOOLS,
          TOOL_NAME.runner,
          WEB_TOOLS,
          ORCHESTRATION_TOOLS,
          DESKTOP_INTERACTION_TOOLS,
          MUX_ADMIN_TOOLS,
        ],
      ),
    },
  };
}

export function getPluginToolPolicy(
  agentId: string,
  role?: string,
): MuxPluginToolPolicy | undefined {
  const policies = buildAgentToolPolicies()[agentId as MuxAgentName];
  if (!policies) return undefined;
  if (role && role in policies) return policies[role as SubAgentRole];
  return policies.main;
}
