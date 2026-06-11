import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface GreperToolArgs {
  readonly intents: readonly string[];
}
import type { HostDependencies } from "../types/deps.js";
import { GREPER_TOOLS } from "engine/agent-policy";
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
    execute: async (config, args: Record<string, unknown>) => {
      const { intents } = args as unknown as GreperToolArgs;

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const delegateOptions = {
        aiSettingsAgentId: 'explore',
        experiments: {
          subagentRole: "greper" as const,
          toolPolicy: {
            disabledTools: [...GREPER_TOOLS.entries()].filter(([, p]) => p._tag === 'Deny').map(([n]) => n),
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
