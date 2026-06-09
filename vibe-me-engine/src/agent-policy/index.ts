export type AgentRole = 'orchestrator' | 'editor' | 'reviewer' | 'greper' | 'browser' | 'runner' | 'reverie';

export interface AgentRuntimePolicy {
  readonly tools: Record<string, boolean>;
  readonly permissions: Record<string, 'allow' | 'deny'>;
  readonly disabledTools: readonly string[];
}

const CANONICAL_TOOL_NAMES = [
  'read',
  'write',
  'edit',
  'runner',
  'glob',
  'fuzzy_find',
  'fuzzy_grep',
  'grep',
  'editor',
  'greper',
  'reverie',
  'submit_review',
  'submit_review_result',
  'webfetch',
  'websearch',
  'browser',
  'task',
  'runner_wait',
  'runner_abort',
  'stealth_browser_mcp_star',
] as const;

type CanonicalToolName = typeof CANONICAL_TOOL_NAMES[number];

function createRuntimeTools(enabledToolNames: readonly CanonicalToolName[]): Record<string, boolean> {
  const enabledTools = new Set<CanonicalToolName>(enabledToolNames);
  return Object.fromEntries(
    CANONICAL_TOOL_NAMES.map((toolName) => [toolName, enabledTools.has(toolName)]),
  );
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

export const AGENT_POLICIES: Record<AgentRole, AgentRuntimePolicy> = {
  orchestrator: {
    tools: createRuntimeTools([
      'read',
      'editor',
      'greper',
      'reverie',
      'submit_review',
      'webfetch',
      'websearch',
      'runner',
      'browser',
      'glob',
    ]),
    permissions: {
      bash: 'deny', edit: 'deny', write: 'deny', grep: 'deny',
      'stealth-browser-mcp_star': 'deny', runner_wait: 'deny', runner_abort: 'deny',
      task: 'deny', glob: 'allow', fuzzy_find: 'deny', fuzzy_grep: 'deny',
      question: 'allow',
    },
    disabledTools: [],
  },

  editor: {
    tools: createRuntimeTools([
      'read',
      'write',
      'edit',
      'runner',
      'glob',
      'fuzzy_find',
      'fuzzy_grep',
    ]),
    permissions: { bash: 'deny', grep: 'deny', task: 'deny' },
    disabledTools: [
      'task', 'editor', 'greper', 'reverie', 'browser', 'submit_review',
      'start_review_loop', 'runner', 'runner_wait', 'runner_abort',
    ],
  },

  reviewer: {
    tools: createRuntimeTools(['read', 'submit_review_result']),
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [
      'submit_review', 'editor', 'greper', 'reverie', 'browser',
      'start_review_loop', 'runner', 'runner_wait', 'runner_abort',
    ],
  },

  greper: {
    tools: createRuntimeTools(['read', 'runner', 'glob', 'fuzzy_find', 'fuzzy_grep']),
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', grep: 'deny', task: 'deny' },
    disabledTools: [
      'greper', 'reverie', 'browser', 'submit_review',
      'start_review_loop', 'runner_wait', 'runner_abort',
    ],
  },

  browser: {
    tools: createRuntimeTools(['read', 'stealth_browser_mcp_star']),
    permissions: { bash: 'deny', edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [...BROWSER_DISABLED_TOOLS],
  },

  runner: {
    tools: createRuntimeTools(['runner_wait', 'runner_abort']),
    permissions: { edit: 'deny', write: 'deny', task: 'deny' },
    disabledTools: [],
  },

  reverie: {
    tools: createRuntimeTools([]),
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

export function getAgentPolicy(role: AgentRole): AgentRuntimePolicy {
  return AGENT_POLICIES[role];
}

type UniversalPermissionDefault = 'allow' | 'deny';

interface UniversalPermissionDefaultRule {
  readonly permissionName: string;
  readonly defaultPermission: UniversalPermissionDefault;
  readonly includedRoles?: readonly AgentRole[];
  readonly excludedRoles?: readonly AgentRole[];
}

const SEARCH_PERMISSION_ROLES: readonly AgentRole[] = ['editor', 'greper'];

const UNIVERSAL_PERMISSION_DEFAULT_RULES: readonly UniversalPermissionDefaultRule[] = [
  { permissionName: 'bash', defaultPermission: 'deny' },
  {
    permissionName: 'stealth-browser-mcp_star',
    defaultPermission: 'deny',
    excludedRoles: ['browser'],
  },
  { permissionName: 'runner_wait', defaultPermission: 'deny', excludedRoles: ['runner'] },
  { permissionName: 'runner_abort', defaultPermission: 'deny', excludedRoles: ['runner'] },
  {
    permissionName: 'submit_review_result',
    defaultPermission: 'deny',
    excludedRoles: ['reviewer'],
  },
  {
    permissionName: 'glob',
    defaultPermission: 'deny',
    excludedRoles: SEARCH_PERMISSION_ROLES,
  },
  {
    permissionName: 'fuzzy_find',
    defaultPermission: 'allow',
    includedRoles: SEARCH_PERMISSION_ROLES,
  },
  {
    permissionName: 'fuzzy_find',
    defaultPermission: 'deny',
    excludedRoles: SEARCH_PERMISSION_ROLES,
  },
  {
    permissionName: 'fuzzy_grep',
    defaultPermission: 'allow',
    includedRoles: SEARCH_PERMISSION_ROLES,
  },
  {
    permissionName: 'fuzzy_grep',
    defaultPermission: 'deny',
    excludedRoles: SEARCH_PERMISSION_ROLES,
  },
  { permissionName: 'grep', defaultPermission: 'deny' },
  { permissionName: 'question', defaultPermission: 'deny', excludedRoles: ['orchestrator'] },
];

function appliesToAgent(rule: UniversalPermissionDefaultRule, agent: AgentRole): boolean {
  return (rule.includedRoles === undefined || rule.includedRoles.includes(agent))
    && (rule.excludedRoles === undefined || !rule.excludedRoles.includes(agent));
}

function applyPermissionDefault(
  permission: Record<string, string>,
  rule: UniversalPermissionDefaultRule,
): void {
  if (permission[rule.permissionName] === undefined) {
    permission[rule.permissionName] = rule.defaultPermission;
  }
}

export function applyUniversalPermissionDeny(
  agent: AgentRole,
  permission: Record<string, string>,
): void {
  for (const rule of UNIVERSAL_PERMISSION_DEFAULT_RULES) {
    if (appliesToAgent(rule, agent)) {
      applyPermissionDefault(permission, rule);
    }
  }
}
