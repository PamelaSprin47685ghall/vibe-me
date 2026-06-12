import type { JobRegistry } from "engine/runner";

export interface RuntimeHandle {
  readonly __brand: "RuntimeHandle";
}

export interface LoggerLike {
  debug: (msg: string, data?: unknown) => void;
}

export interface AgentDefinitionPackage {
  readonly id: string;
  readonly scope: string;
  readonly frontmatter: {
    readonly name: string;
    readonly ai?: { readonly model?: string; readonly thinkingLevel?: string };
  };
  readonly body: string;
}

export interface AgentFrontmatterPackage {
  readonly name: string;
  readonly ai?: { readonly model?: string; readonly thinkingLevel?: string };
}

export interface AgentInheritanceEntry {
  readonly id: string;
}

export interface AgentInheritanceRequest {
  readonly runtime: RuntimeHandle | null;
  readonly workspacePath: string;
  readonly agentId: string;
  readonly agentDefinition: AgentDefinitionPackage;
  readonly workspaceId: string;
  readonly maxDepth?: number;
}

export interface WorkspaceAiSettings {
  readonly model: string;
  readonly thinkingLevel?: string;
}

export interface WorkspaceEntry {
  readonly id: string;
  readonly aiSettings?: WorkspaceAiSettings;
  readonly aiSettingsByAgent?: Record<string, WorkspaceAiSettings>;
}

export interface ProjectEntry {
  readonly workspaces: readonly WorkspaceEntry[];
}

export interface ConfigFile {
  readonly projects?: Map<string, ProjectEntry>;
  readonly agentAiDefaults?: Record<
    string,
    { readonly modelString?: string; readonly thinkingLevel?: string } | undefined
  >;
  readonly subagentAiDefaults?: Record<
    string,
    { readonly modelString?: string; readonly thinkingLevel?: string } | undefined
  >;
}

export interface FindWorkspaceEntryResult {
  readonly workspace: WorkspaceEntry;
}

export interface TaskCreateInput {
  readonly parentWorkspaceId: string;
  readonly kind: "agent";
  readonly agentId: string;
  readonly modelString?: string;
  readonly thinkingLevel?: string;
  readonly prompt: string;
  readonly title: string;
  readonly experiments?: { readonly subagentRole?: string; readonly toolPolicy?: { readonly disabledTools?: readonly string[] } };
}

export type TaskCreateResult =
  | { readonly success: true; readonly data: { readonly taskId: string; readonly kind: string; readonly status: string } }
  | { readonly success: false; readonly error: string };

export interface TaskWaitOptions {
  readonly requestingWorkspaceId: string;
  readonly abortSignal?: AbortSignal;
  readonly backgroundOnMessageQueued?: boolean;
  readonly timeoutMs?: number;
}

export interface TaskWaitResult {
  readonly reportMarkdown: string;
}

export interface TaskServiceLike {
  create(input: TaskCreateInput): Promise<TaskCreateResult>;
  waitForAgentReport(
    taskId: string,
    opts: TaskWaitOptions,
  ): Promise<TaskWaitResult>;
}

export interface HostDependencies {
  readonly log: LoggerLike;
  readonly runnerJobs: JobRegistry;
  readonly taskService?: TaskServiceLike;
  readonly loadConfigOrDefault: () => ConfigFile;
  readonly readAgentDefinition: (
    runtime: RuntimeHandle | null,
    workspacePath: string,
    agentId: string,
  ) => Promise<AgentDefinitionPackage>;
  readonly resolveAgentFrontmatter: (
    runtime: RuntimeHandle | null,
    workspacePath: string,
    agentId: string,
  ) => Promise<AgentFrontmatterPackage>;
  readonly resolveAgentInheritanceChain: (
    request: AgentInheritanceRequest,
  ) => Promise<readonly AgentInheritanceEntry[]>;
  readonly findWorkspaceEntry: (
    configFile: ConfigFile,
    workspaceId: string,
  ) => FindWorkspaceEntryResult | undefined;
}
