import type { BrowserToolArgs, JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
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
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as BrowserToolArgs;
      return delegateToSubAgent(config, deps, "desktop", intent, "Browser", {
        experiments: {
          toolPolicy: {
            disabledTools: [
              "browser",
              "editor",
              "greper",
              "reverie",
              "submit_review",
              "start_review_loop",
              "runner",
              "runner_wait",
              "runner_abort",
            ],
          },
        },
      });
    },
  };
}
