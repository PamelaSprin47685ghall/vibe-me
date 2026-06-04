import type { ConfigFile, HostDependencies } from "../types/deps.js";
import type { PluginToolConfiguration } from "../types/tool.js";

export interface ResolvedDelegatedAgentAiSettings {
  readonly modelString: string;
  readonly thinkingLevel: string;
}

interface NamedSettings {
  readonly modelString?: string;
  readonly thinkingLevel?: string;
}

export function createResolveDelegatedAgentAiSettings(deps: HostDependencies) {
  return async function resolveDelegatedAgentAiSettings(
    config: PluginToolConfiguration,
    agentId: string,
  ): Promise<ResolvedDelegatedAgentAiSettings> {
    const configFile: ConfigFile = deps.loadConfigOrDefault();
    const workspace = config.workspaceId
      ? deps.findWorkspaceEntry(configFile, config.workspaceId)?.workspace
      : undefined;

    const agentIds = await resolveInheritanceChain(deps, config, agentId);

    const sources = [
      resolveInheritedWorkspaceAiSettings(agentIds, workspace),
      configFile.subagentAiDefaults?.[agentId],
      resolveInheritedConfigAiSettings(agentIds, configFile.agentAiDefaults),
      await resolveDescriptorAiSettings(deps, config, agentId),
    ];

    return {
      modelString: firstField(sources, "modelString") ?? deps.defaultModel,
      thinkingLevel: firstField(sources, "thinkingLevel") ?? "off",
    };
  };
}

function firstField(
  sources: readonly (NamedSettings | undefined)[],
  key: "modelString" | "thinkingLevel",
): string | undefined {
  for (const s of sources) {
    const v = s?.[key];
    if (v != null) return v;
  }
  return undefined;
}

async function resolveInheritanceChain(
  deps: HostDependencies,
  config: PluginToolConfiguration,
  agentId: string,
): Promise<readonly string[]> {
  const workspaceId = config.workspaceId ?? config.cwd;
  try {
    const def = await deps.readAgentDefinition(
      config.runtime ?? null,
      config.cwd,
      agentId,
    );
    const chain = await deps.resolveAgentInheritanceChain({
      runtime: config.runtime ?? null,
      workspacePath: config.cwd,
      agentId: def.id,
      agentDefinition: def,
      workspaceId,
    });
    return chain.map((e) => e.id);
  } catch {
    return [agentId];
  }
}

async function resolveDescriptorAiSettings(
  deps: HostDependencies,
  config: PluginToolConfiguration,
  agentId: string,
): Promise<NamedSettings> {
  try {
    const fm = await deps.resolveAgentFrontmatter(
      config.runtime ?? null,
      config.cwd,
      agentId,
    );
    return {
      modelString: fm.ai?.model,
      thinkingLevel: fm.ai?.thinkingLevel,
    };
  } catch {
    return {};
  }
}

function resolveInheritedConfigAiSettings(
  agentIds: readonly string[],
  entries:
    | Record<string, NamedSettings | undefined>
    | undefined,
): NamedSettings | undefined {
  for (const id of agentIds) {
    const e = entries?.[id];
    if (e) return e;
  }
  return undefined;
}

function resolveInheritedWorkspaceAiSettings(
  agentIds: readonly string[],
  workspace:
    | {
        readonly aiSettingsByAgent?: Record<
          string,
          { readonly model: string; readonly thinkingLevel?: string }
        >;
        readonly aiSettings?: { readonly model: string; readonly thinkingLevel?: string };
      }
    | undefined,
): NamedSettings | undefined {
  for (const id of agentIds) {
    const e = workspace?.aiSettingsByAgent?.[id];
    if (e) return { modelString: e.model, thinkingLevel: e.thinkingLevel };
  }
  if (workspace?.aiSettingsByAgent == null && workspace?.aiSettings) {
    return {
      modelString: workspace.aiSettings.model,
      thinkingLevel: workspace.aiSettings.thinkingLevel,
    };
  }
  return undefined;
}
