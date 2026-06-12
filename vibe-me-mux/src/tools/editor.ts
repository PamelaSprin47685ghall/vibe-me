import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireStringArray } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { deniedToolsFor } from "./policy.js";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intents: {
      type: "array",
      items: { type: "string" },
      description:
        "Array of independent code-change intents, each run in parallel via its own editor subagent session. Include all relevant background, design rationale, file paths, and specific requirements.",
    },
  },
  required: ["intents"],
  additionalProperties: false,
};

export function createEditorTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "editor",
    description:
      "Execute code changes based on natural-language intents. Each intent in the array spawns its own editor subagent session. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.",
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const intents = requireStringArray(args, 'intents');

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const delegateOptions = {
        aiSettingsAgentId: 'exec',
        experiments: {
          subagentRole: "editor" as const,
          toolPolicy: {
            disabledTools: deniedToolsFor("editor"),
          },
        },
      };

      const results = await Promise.all(
        intents.map((singleIntent) =>
          delegateToSubAgent(config, deps, "exec", singleIntent, "Editor", delegateOptions),
        ),
      );
      return results.join("\n---\n");
    },
  };
}
