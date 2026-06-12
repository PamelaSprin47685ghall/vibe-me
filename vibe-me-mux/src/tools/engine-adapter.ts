import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import type { AgentRole, HostAdapter } from "engine";
import { agentRoleToString, subagentToolPolicy } from "engine";
import { delegateToSubAgent } from "./delegate.js";

type Routing = { readonly agentId: string; readonly aiSettingsAgentId: string };

const ROUTING: Partial<Record<AgentRole["_tag"], Routing>> = {
  Editor: { agentId: "exec", aiSettingsAgentId: "exec" },
  Greper: { agentId: "explore", aiSettingsAgentId: "explore" },
  Browser: { agentId: "explore", aiSettingsAgentId: "explore" },
  Reverie: { agentId: "explore", aiSettingsAgentId: "exec" },
};

export function createEngineAdapter(
  config: PluginToolConfiguration,
  deps: HostDependencies,
): HostAdapter {
  return {
    promptSubagent: ({ role, prompt, title }) => {
      const routing = ROUTING[role._tag];
      if (!routing) throw new Error(`No mux routing for subagent role ${role._tag}`);
      return delegateToSubAgent(config, deps, routing.agentId, prompt, title, {
        aiSettingsAgentId: routing.aiSettingsAgentId,
        experiments: {
          subagentRole: agentRoleToString(role),
          toolPolicy: { disabledTools: subagentToolPolicy(role).disabledTools },
        },
      });
    },
  };
}
