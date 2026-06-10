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
      resolveWorkspaceExecFallback(workspace),
    ];

    return {
      modelString: firstField(sources, "modelString"),
      thinkingLevel: firstField(sources, "thinkingLevel"),
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
  if (!workspace?.aiSettingsByAgent) return undefined;
  const exec = workspace.aiSettingsByAgent["exec"] ?? Object.values(workspace.aiSettingsByAgent)[0];
  return exec ? { modelString: exec.model, thinkingLevel: exec.thinkingLevel } : undefined;
}
