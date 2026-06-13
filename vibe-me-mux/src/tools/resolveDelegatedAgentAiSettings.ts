import type { ConfigFile, HostDependencies } from "../types/deps.js";
import type { PluginToolConfiguration } from "../types/tool.js";

export interface ResolvedDelegatedAgentAiSettings {
  readonly modelString?: string;
  readonly thinkingLevel?: string;
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

    const sources = [
      resolveWorkspaceAiSettings(agentId, workspace),
      configFile.subagentAiDefaults?.[agentId],
      configFile.agentAiDefaults?.[agentId],
      await resolveDescriptorAiSettings(deps, config, agentId),
      agentId === "exec" ? resolveWorkspaceExecFallback(workspace) : undefined,
    ];

    return mergeNamedSettings(sources);
  };
}

function mergeNamedSettings(
  sources: readonly (NamedSettings | undefined)[],
): NamedSettings {
  let modelString: string | undefined;
  let thinkingLevel: string | undefined;
  for (const source of sources) {
    if (modelString == null && source?.modelString != null) {
      modelString = source.modelString;
    }
    if (thinkingLevel == null && source?.thinkingLevel != null) {
      thinkingLevel = source.thinkingLevel;
    }
  }
  return { modelString, thinkingLevel };
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

function resolveWorkspaceAiSettings(
  agentId: string,
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
  const e = workspace?.aiSettingsByAgent?.[agentId];
  return e ? { modelString: e.model, thinkingLevel: e.thinkingLevel } : undefined;
}

function resolveWorkspaceExecFallback(
  workspace:
    | {
        readonly aiSettingsByAgent?: Record<
          string,
          { readonly model: string; readonly thinkingLevel?: string }
        >;
      }
    | undefined,
): NamedSettings | undefined {
  const settings = workspace?.aiSettingsByAgent?.["exec"];
  return settings
    ? { modelString: settings.model, thinkingLevel: settings.thinkingLevel }
    : undefined;
}
