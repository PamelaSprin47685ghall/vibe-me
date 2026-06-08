export type AgentRole = 'orchestrator' | 'editor' | 'reviewer' | 'greper' | 'browser' | 'runner' | 'reverie';

export interface AgentToolPolicy {
  readonly tools: Record<string, boolean>;
  readonly permissions: Record<string, 'allow' | 'deny'>;
  readonly disabledTools: readonly string[];
}

const BROWSER_DISABLED_TOOLS = [
  'glob', 'greper', 'fuzzy_find', 'fuzzy_grep', 'runner', 'browser', 'editor',
  'reverie', 'submit_review', 'start_review_loop', 'write', 'file_edit_replace_string',
  'file_edit_insert', 'attach_file', 'runner_wait', 'runner_abort', 'web_fetch',
  'web_search', 'websearch', 'webfetch', 'ask_user_question', 'propose_plan',
  'todo_read', 'todo_write', 'advisor', 'notify', 'get_goal', 'complete_goal',
  'review_pane_update', 'review_pane_get', 'analytics_query', 'desktop_screenshot',
  'desktop_move_mouse', 'desktop_click', 'desktop_double_click', 'desktop_drag',
  'desktop_scroll', 'desktop_type', 'desktop_key_press', 'agent_skill_read',
  'agent_skill_read_file', 'agent_skill_list', 'agent_skill_write',
  'agent_skill_delete', 'skills_catalog_search', 'skills_catalog_read',
  'mux_agents_read', 'mux_agents_write', 'mux_config_read', 'mux_config_write',
  'bash', 'bash_output', 'bash_background_list', 'bash_background_terminate', 'grep',
] as const;

export const AGENT_POLICIES: Record<AgentRole, AgentToolPolicy> = {
  orchestrator: {
    tools: {
      read: true, editor: true, greper: true, reverie: true, submit_review: true,
      webfetch: true, websearch: true, runner: true, browser: true, glob: true,
      fuzzy_find: false, fuzzy_grep: false, grep: false, edit: false, write: false,
      task: false, runner_wait: false, runner_abort: false, submit_review_result: false,
      stealth_browser_mcp_star: false,
    },
    permissions: {
      bash: 'deny', edit: 'deny', write: 'deny', grep: 'deny',
      'stealth-browser-mcp_star': 'deny', runner_wait: 'deny', runner_abort: 'deny',
      task: 'deny', glob: 'allow', fuzzy_find: 'deny', fuzzy_grep: 'deny',
      question: 'allow',
    },
    disabledTools: [],
  },

  editor: {
    tools: {
      read: true, write: true, edit: true, runner: true, glob: true,
      fuzzy_find: true, fuzzy_grep: true,
      grep: false, editor: false, greper: false, reverie: false,
      submit_review: false, submit_review_result: false, webfetch: false,
      websearch: false, browser: false, task: false, runner_wait: false,
      runner_abort: false, stealth_browser_mcp_star: false,
    },
    permissions: { bash: 'deny', grep: 'deny', task: 'deny' },
    disabledTools: [
      'task', 'editor', 'greper', 'reverie', 'browser', 'submit_review',
      'start_review_loop', 'runner', 'runner_wait', 'runner_abort',
    ],
  },

  reviewer: {
    tools: {
      read: true, submit_review_result: true,
      write: false, edit: false, runner: false, glob: false, fuzzy_find: false,
      fuzzy_grep: false, grep: false, editor: false, greper: false, reverie: false,
      submit_review: false, webfetch: false, websearch: false, browser: false,
      task: false, runner_wait: false, runner_abort: false,
      stealth_browser_mcp_star: false,
    },
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [
      'submit_review', 'editor', 'greper', 'reverie', 'browser',
      'start_review_loop', 'runner', 'runner_wait', 'runner_abort',
    ],
  },

  greper: {
    tools: {
      read: true, runner: true, glob: true, fuzzy_find: true, fuzzy_grep: true,
      write: false, edit: false, grep: false, editor: false, greper: false,
      reverie: false, submit_review: false, submit_review_result: false,
      webfetch: false, websearch: false, browser: false, task: false,
      runner_wait: false, runner_abort: false, stealth_browser_mcp_star: false,
    },
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', grep: 'deny', task: 'deny' },
    disabledTools: [
      'greper', 'reverie', 'browser', 'submit_review',
      'start_review_loop', 'runner_wait', 'runner_abort',
    ],
  },

  browser: {
    tools: {
      read: true, stealth_browser_mcp_star: true,
      write: false, edit: false, runner: false, glob: false, fuzzy_find: false,
      fuzzy_grep: false, grep: false, editor: false, greper: false, reverie: false,
      submit_review: false, submit_review_result: false, webfetch: false,
      websearch: false, browser: false, task: false, runner_wait: false,
      runner_abort: false,
    },
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [...BROWSER_DISABLED_TOOLS],
  },

  runner: {
    tools: {
      runner_wait: true, runner_abort: true,
      read: false, write: false, edit: false, runner: false, glob: false,
      fuzzy_find: false, fuzzy_grep: false, grep: false, editor: false,
      greper: false, reverie: false, submit_review: false, submit_review_result: false,
      webfetch: false, websearch: false, browser: false, task: false,
      stealth_browser_mcp_star: false,
    },
    permissions: { edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [],
  },

  reverie: {
    tools: {
      read: false, write: false, edit: false, runner: false, glob: false,
      fuzzy_find: false, fuzzy_grep: false, grep: false, editor: false,
      greper: false, reverie: false, submit_review: false, submit_review_result: false,
      webfetch: false, websearch: false, browser: false, task: false,
      runner_wait: false, runner_abort: false, stealth_browser_mcp_star: false,
    },
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [
      'reverie', 'greper', 'editor', 'browser', 'submit_review',
      'start_review_loop', 'runner', 'runner_wait', 'runner_abort', 'read',
    ],
  },
};

export const AGENT_ROLE_LIST: readonly AgentRole[] = [
  'orchestrator', 'editor', 'reviewer', 'greper', 'browser', 'runner', 'reverie',
];

export function isAgentRole(name: string): name is AgentRole {
  return (AGENT_ROLE_LIST as readonly string[]).includes(name);
}

export function getAgentPolicy(role: AgentRole): AgentToolPolicy {
  return AGENT_POLICIES[role];
}

export function applyUniversalPermissionDeny(
  agent: AgentRole,
  permission: Record<string, string>,
): void {
  const is = (r: AgentRole) => agent === r;
  const inRoles = (roles: readonly AgentRole[]) => (roles as readonly string[]).includes(agent);

  if (permission['bash'] === undefined) permission['bash'] = 'deny';
  if (permission['stealth-browser-mcp_star'] === undefined && !is('browser')) {
    permission['stealth-browser-mcp_star'] = 'deny';
  }
  if (permission['runner_wait'] === undefined && !is('runner')) {
    permission['runner_wait'] = 'deny';
  }
  if (permission['runner_abort'] === undefined && !is('runner')) {
    permission['runner_abort'] = 'deny';
  }
  if (permission['submit_review_result'] === undefined && !is('reviewer')) {
    permission['submit_review_result'] = 'deny';
  }
  if (permission['glob'] === undefined && !inRoles(['editor', 'greper'])) {
    permission['glob'] = 'deny';
  }
  if (permission['fuzzy_find'] === undefined) {
    permission['fuzzy_find'] = inRoles(['editor', 'greper']) ? 'allow' : 'deny';
  }
  if (permission['fuzzy_grep'] === undefined) {
    permission['fuzzy_grep'] = inRoles(['editor', 'greper']) ? 'allow' : 'deny';
  }
  if (permission['grep'] === undefined) permission['grep'] = 'deny';
  if (permission['question'] === undefined && !is('orchestrator')) {
    permission['question'] = 'deny';
  }
}
