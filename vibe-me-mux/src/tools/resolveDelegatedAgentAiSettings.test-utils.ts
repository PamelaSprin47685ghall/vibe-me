import { mock } from "bun:test";
import { createJobRegistry } from "engine/runner";
import type { PluginToolConfiguration } from "../types/tool.js";
import type {
  HostDependencies,
  AgentDefinitionPackage,
  AgentFrontmatterPackage,
  ConfigFile,
  FindWorkspaceEntryResult,
} from "../types/deps.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";

function findWorkspaceEntry(
  configFile: ConfigFile,
  workspaceId: string,
): FindWorkspaceEntryResult | undefined {
  for (const project of configFile.projects?.values() ?? []) {
    const found = project.workspaces.find((w) => w.id === workspaceId);
    if (found) return { workspace: found };
  }
  return undefined;
}

export function createMockDeps() {
  const loadConfigOrDefault = mock<() => ConfigFile>(() => ({
    projects: new Map(),
    agentAiDefaults: {},
    subagentAiDefaults: {},
  }));
  const readAgentDefinition = mock<
    (
      runtime: unknown,
      workspacePath: string,
      agentId: string,
    ) => Promise<AgentDefinitionPackage>
  >((_runtime, _workspacePath, agentId) =>
    Promise.resolve({
      id: agentId,
      scope: "built-in",
      frontmatter: { name: agentId },
      body: "",
    }),
  );
  const resolveAgentFrontmatter = mock<
    (
      runtime: unknown,
      workspacePath: string,
      agentId: string,
    ) => Promise<AgentFrontmatterPackage>
  >(() => Promise.resolve({ name: "" }));
  const resolveAgentInheritanceChain = mock<
    (_args: unknown) => Promise<never>
  >(() => {
    throw new Error("resolveAgentInheritanceChain should not be called");
  });

  const deps: HostDependencies = {
    log: { debug: () => undefined },
    runnerJobs: createJobRegistry(),
    loadConfigOrDefault: () => loadConfigOrDefault(),
    readAgentDefinition: (runtime, workspacePath, agentId) =>
      readAgentDefinition(runtime, workspacePath, agentId),
    resolveAgentFrontmatter: (runtime, workspacePath, agentId) =>
      resolveAgentFrontmatter(runtime, workspacePath, agentId),
    resolveAgentInheritanceChain: (args) => resolveAgentInheritanceChain(args),
    findWorkspaceEntry,
  };

  const resolve = createResolveDelegatedAgentAiSettings(deps);

  return {
    loadConfigOrDefault,
    readAgentDefinition,
    resolveAgentFrontmatter,
    resolveAgentInheritanceChain,
    deps,
    resolve,
  };
}

export function createToolConfig(): PluginToolConfiguration {
  return { cwd: "/repo/workspace", runtime: null, workspaceId: "ws-1" };
}
