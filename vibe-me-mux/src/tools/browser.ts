import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface BrowserToolArgs {
  readonly intent: string;
}
import type { HostDependencies } from "../types/deps.js";
import { AGENT_POLICIES } from "engine/agent-policy";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: "Natural-language description of the web task to perform",
    },
  },
  required: ["intent"],
  additionalProperties: false,
};

export function createBrowserTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "browser",
    description:
      "Receive a natural-language intent for a web task and delegate to the browser agent. IMPORTANT: Do NOT assume the browser agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const { intent } = args as unknown as BrowserToolArgs;
      return delegateToSubAgent(config, deps, "explore", intent, "Browser", {
        aiSettingsAgentId: "explore",
        experiments: {
          subagentRole: "browser",
          toolPolicy: {
            disabledTools: [...AGENT_POLICIES.browser.disabledTools],
          },
        },
      });
    },
  };
}
