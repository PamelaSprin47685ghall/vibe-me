import { createRegistration, type MuxDeps } from "mux-kunwei";
import { defaultModel } from "@/common/utils/ai/models";
import { defaultConfig } from "@/node/config";
import { log } from "@/node/services/log";
import {
  readAgentDefinition,
  resolveAgentFrontmatter,
} from "@/node/services/agentDefinitions/agentDefinitionsService";
import { resolveAgentInheritanceChain } from "@/node/services/agentDefinitions/resolveAgentInheritanceChain";
import { findWorkspaceEntry } from "@/node/services/taskUtils";
import type { AddonRegistration } from "@/common/utils/tools/addonRegistry";

const deps = {
  log,
  defaultModel,
  loadConfigOrDefault: () => defaultConfig.loadConfigOrDefault(),
  readAgentDefinition: (runtime: unknown, workspacePath: string, agentId: string) =>
    readAgentDefinition(
      runtime as Parameters<typeof readAgentDefinition>[0],
      workspacePath,
      agentId,
    ),
  resolveAgentFrontmatter: (runtime: unknown, workspacePath: string, agentId: string) =>
    resolveAgentFrontmatter(
      runtime as Parameters<typeof resolveAgentFrontmatter>[0],
      workspacePath,
      agentId,
    ),
  resolveAgentInheritanceChain: (args: unknown) =>
    resolveAgentInheritanceChain(
      args as Parameters<typeof resolveAgentInheritanceChain>[0],
    ),
  findWorkspaceEntry: (configFile: unknown, workspaceId: string) =>
    findWorkspaceEntry(
      configFile as Parameters<typeof findWorkspaceEntry>[0],
      workspaceId,
    ),
} as unknown as MuxDeps;

const registration = createRegistration(deps) as unknown as AddonRegistration;

export { registration };
