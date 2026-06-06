import type { EditorToolArgs, JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { EDITOR_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: "Natural-language description of the code changes to make",
    },
  },
  required: ["intent"],
  additionalProperties: false,
};

export function createEditorTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "editor",
    description:
      "Receive a natural-language intent for code changes and delegate to the editor agent. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as EditorToolArgs;
      return delegateToSubAgent(config, deps, "exec", intent, "Editor", {
        experiments: {
          subagentRole: "editor",
          toolPolicy: {
            disabledTools: [...EDITOR_SUB_AGENT_DISABLED_TOOLS],
          },
        },
      });
    },
  };
}
