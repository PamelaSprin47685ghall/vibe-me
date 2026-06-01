export interface AgentDefinition {
  id: string;
  scope: string;
  frontmatter: { name: string; ai?: { model?: string; thinkingLevel?: string } };
  body: string;
}

export interface AgentFrontmatter {
  name: string;
  ai?: { model?: string; thinkingLevel?: string };
}

export interface AgentInheritanceEntry {
  id: string;
}

export interface AgentInheritanceArgs {
  runtime: unknown;
  workspacePath: string;
  agentId: string;
  agentDefinition: AgentDefinition;
  workspaceId?: string;
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

export interface LoggerLike {
  debug: (msg: string, data?: unknown) => void;
}

export interface MuxDeps {
  log: LoggerLike;
  defaultModel: string;
  loadConfigOrDefault: () => ConfigFile;
  readAgentDefinition: (runtime: unknown, workspacePath: string, agentId: string) => Promise<AgentDefinition>;
  resolveAgentFrontmatter: (runtime: unknown, workspacePath: string, agentId: string) => Promise<AgentFrontmatter>;
  resolveAgentInheritanceChain: (args: AgentInheritanceArgs) => Promise<AgentInheritanceEntry[]>;
  findWorkspaceEntry: (configFile: ConfigFile, workspaceId: string) => FindWorkspaceEntryResult | undefined;
}
