export interface LoggerLike {
  debug: (msg: string, data?: unknown) => void;
}

export interface AgentDefinitionPackage {
  id: string;
  scope: string;
  frontmatter: { name: string; ai?: { model?: string; thinkingLevel?: string } };
  body: string;
}

export interface AgentFrontmatterPackage {
  name: string;
  ai?: { model?: string; thinkingLevel?: string };
}

export interface AgentInheritanceEntry {
  id: string;
}

export interface AgentInheritanceRequest {
  runtime: unknown;
  workspacePath: string;
  agentId: string;
  agentDefinition: AgentDefinitionPackage;
  workspaceId: string;
  maxDepth?: number;
}

export interface WorkspaceAiSettings {
  model: string;
  thinkingLevel?: string;
}

export interface WorkspaceEntry {
  id: string;
  aiSettings?: WorkspaceAiSettings;
  aiSettingsByAgent?: Record<string, WorkspaceAiSettings>;
}

export interface ProjectEntry {
  workspaces: WorkspaceEntry[];
}

export interface ConfigFile {
  projects?: Map<string, ProjectEntry>;
  agentAiDefaults?: Record<string, { modelString?: string; thinkingLevel?: string } | undefined>;
  subagentAiDefaults?: Record<string, { modelString?: string; thinkingLevel?: string } | undefined>;
}

export interface FindWorkspaceEntryResult {
  workspace: WorkspaceEntry;
}

export interface TaskCreateInput {
  parentWorkspaceId: string;
  kind: "agent";
  agentId: string;
  modelString: string;
  thinkingLevel: string;
  prompt: string;
  title: string;
  experiments?: { toolPolicy?: { disabledTools?: string[] } };
}

export type TaskCreateResult =
  | { success: true; data: { taskId: string; kind: string; status: string } }
  | { success: false; error: string };

export interface TaskWaitOptions {
  requestingWorkspaceId: string;
  abortSignal?: AbortSignal;
}

export interface TaskWaitResult {
  reportMarkdown: string;
}

export interface TaskServiceLike {
  create(input: TaskCreateInput): Promise<TaskCreateResult>;
  waitForAgentReport(taskId: string, opts: TaskWaitOptions): Promise<TaskWaitResult>;
}

/**
 * Contract the host must satisfy when registering the plugin.
 *
 * Only structural types are referenced here — the plugin compiles
 * independently of the host and relies on TS structural matching at
 * the consumer site to catch mismatches. `TaskServiceLike` is the
 * contract for `config.taskService`, which the host threads through
 * the per-tool `PluginToolConfiguration`.
 */
export interface HostDependencies {
  log: LoggerLike;
  defaultModel: string;
  loadConfigOrDefault: () => ConfigFile;
  readAgentDefinition: (runtime: unknown, workspacePath: string, agentId: string) => Promise<AgentDefinitionPackage>;
  resolveAgentFrontmatter: (runtime: unknown, workspacePath: string, agentId: string) => Promise<AgentFrontmatterPackage>;
  resolveAgentInheritanceChain: (request: AgentInheritanceRequest) => Promise<AgentInheritanceEntry[]>;
  findWorkspaceEntry: (configFile: ConfigFile, workspaceId: string) => FindWorkspaceEntryResult | undefined;
}
