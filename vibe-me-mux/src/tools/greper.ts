import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireStringArray } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { greperRole, delegateIntents } from "engine";
import { createEngineAdapter } from "./engine-adapter.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intents: {
      type: "array",
      items: { type: "string" },
      description: TOOL_COPY.greper.params.intents,
    },
  },
  required: ["intents"],
  additionalProperties: false,
};

export function createGreperTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "greper",
    description: TOOL_COPY.greper.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const intents = requireStringArray(args, 'intents');

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const adapter = createEngineAdapter(config, deps);
      return delegateIntents(adapter, greperRole, "Greper", intents);
    },
  };
}
