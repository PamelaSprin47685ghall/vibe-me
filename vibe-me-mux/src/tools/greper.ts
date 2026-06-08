import type { GreperToolArgs, JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { GREPER_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intents: {
      type: "array",
      items: { type: "string" },
      description:
        "Array of independent code-search intents, each run in parallel via its own search subagent session. Include all relevant background, design rationale, file paths, and specific requirements.",
    },
  },
  required: ["intents"],
  additionalProperties: false,
};

export function createGreperTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "greper",
    description:
      "Search the codebase based on natural-language intents. Each intent in the array spawns its own search subagent session. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const { intents } = args as GreperToolArgs;

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const delegateOptions = {
        experiments: {
          subagentRole: "greper" as const,
          toolPolicy: {
            disabledTools: [...GREPER_SUB_AGENT_DISABLED_TOOLS],
          },
        },
      };

      const results = await Promise.all(
        intents.map((singleIntent) =>
          delegateToSubAgent(config, deps, "explore", singleIntent, "Greper", delegateOptions),
        ),
      );
      return results.join("\n---\n");
    },
  };
}
