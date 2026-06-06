import type { GreperToolArgs, JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { GREPER_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: "Natural-language description of the code to search for",
    },
  },
  required: ["intent"],
  additionalProperties: false,
};

export function createGreperTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "greper",
    description:
      "Receive a natural-language intent for code search and delegate to the search agent. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as GreperToolArgs;
      return delegateToSubAgent(config, deps, "explore", intent, "Greper", {
        experiments: {
          subagentRole: "greper",
          toolPolicy: {
            disabledTools: [...GREPER_SUB_AGENT_DISABLED_TOOLS],
          },
        },
      });
    },
  };
}
