import type { ConfigFile } from "../types/deps";
import type { ToolConfiguration } from "../types/tool";
import type { MuxDeps } from "../types/deps";

declare global {
  // eslint-disable-next-line no-var
  var __kunweiDeps: MuxDeps | undefined;
}

export function bindResolveDeps(deps: MuxDeps): void {
  globalThis.__kunweiDeps = deps;
}

function requireDeps(): MuxDeps {
  const deps = globalThis.__kunweiDeps;
  if (!deps) {
    throw new Error(
      "mux-kunwei: deps not bound. Call createRegistration(deps) before using any kunwei tool.",
    );
  }
  return deps;
}

interface ResolvedDelegatedAgentAiSettings {
  modelString: string;
  thinkingLevel: string;
}

interface PartialAiSettings {
  modelString?: string;
  thinkingLevel?: string;
}

function resolveInheritedConfigAiSettings(
  agentIds: readonly string[],
  entries: Record<string, { modelString?: string; thinkingLevel?: string } | undefined> | undefined
): PartialAiSettings {
  let modelString: string | undefined;
  let thinkingLevel: string | undefined;

  for (const agentId of agentIds) {
    const entry = entries?.[agentId];
    modelString ??= entry?.modelString;
    thinkingLevel ??= entry?.thinkingLevel;
    if (modelString != null && thinkingLevel != null) {
      break;
    }
  }

  return { modelString, thinkingLevel };
}

function resolveInheritedWorkspaceAiSettings(
  agentIds: readonly string[],
  workspace:
    | {
        aiSettingsByAgent?: Record<string, { model: string; thinkingLevel?: string }>;
        aiSettings?: { model: string; thinkingLevel?: string };
      }
    | undefined
): PartialAiSettings {
  let modelString: string | undefined;
  let thinkingLevel: string | undefined;

  for (const agentId of agentIds) {
    const entry = workspace?.aiSettingsByAgent?.[agentId];
    modelString ??= entry?.model;
    thinkingLevel ??= entry?.thinkingLevel;
    if (modelString != null && thinkingLevel != null) {
      break;
    }
  }

  if (workspace?.aiSettingsByAgent == null) {
    modelString ??= workspace?.aiSettings?.model;
    thinkingLevel ??= workspace?.aiSettings?.thinkingLevel;
  }

  return { modelString, thinkingLevel };
}

async function resolveAgentInheritance(config: ToolConfiguration, agentId: string): Promise<string[]> {
  const deps = requireDeps();
  const workspaceId = config.workspaceId ?? config.cwd;

  try {
    const agentDefinition = await deps.readAgentDefinition(config.runtime, config.cwd, agentId);
    const chain = await deps.resolveAgentInheritanceChain({
      runtime: config.runtime,
      workspacePath: config.cwd,
      agentId: agentDefinition.id,
      agentDefinition,
      workspaceId,
    });
    return chain.map((entry) => entry.id);
  } catch {
    return [agentId];
  }
}

async function resolveDescriptorAiSettings(
  config: ToolConfiguration,
  agentId: string
): Promise<PartialAiSettings> {
  const deps = requireDeps();
  try {
    const frontmatter = await deps.resolveAgentFrontmatter(config.runtime, config.cwd, agentId);
    return {
      modelString: frontmatter.ai?.model,
      thinkingLevel: frontmatter.ai?.thinkingLevel,
    };
  } catch {
    return {};
  }
}

export async function resolveDelegatedAgentAiSettings(
  config: ToolConfiguration,
  agentId: string
): Promise<ResolvedDelegatedAgentAiSettings> {
  const deps = requireDeps();
  const configFile: ConfigFile = deps.loadConfigOrDefault();
  const workspace = config.workspaceId
    ? deps.findWorkspaceEntry(configFile, config.workspaceId)?.workspace
    : undefined;
  const inheritanceChain = await resolveAgentInheritance(config, agentId);
  const workspaceAiSettings = resolveInheritedWorkspaceAiSettings(inheritanceChain, workspace);
  const directSubagentAiSettings = configFile.subagentAiDefaults?.[agentId];
  const inheritedAgentAiSettings = resolveInheritedConfigAiSettings(
    inheritanceChain,
    configFile.agentAiDefaults
  );
  const descriptorAiSettings = await resolveDescriptorAiSettings(config, agentId);

  return {
    modelString:
      workspaceAiSettings.modelString ??
      directSubagentAiSettings?.modelString ??
      inheritedAgentAiSettings.modelString ??
      descriptorAiSettings.modelString ??
      deps.defaultModel,
    thinkingLevel:
      workspaceAiSettings.thinkingLevel ??
      directSubagentAiSettings?.thinkingLevel ??
      inheritedAgentAiSettings.thinkingLevel ??
      descriptorAiSettings.thinkingLevel ??
      "off",
  };
}
