import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { browserRole } from "engine";
import { createEngineAdapter } from "./engine-adapter.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: TOOL_COPY.browser.params.intent,
    },
  },
  required: ["intent"],
  additionalProperties: false,
};

export function createBrowserTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "browser",
    description: TOOL_COPY.browser.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const intent = requireString(args, 'intent');
      const adapter = createEngineAdapter(config, deps);
      return adapter.promptSubagent({ role: browserRole, prompt: intent, title: "Browser" });
    },
  };
}
