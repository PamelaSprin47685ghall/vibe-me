import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireStringArray } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { editorRole, delegateIntents } from "engine";
import { createEngineAdapter } from "./engine-adapter.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intents: {
      type: "array",
      items: { type: "string" },
      description: TOOL_COPY.editor.params.intents,
    },
  },
  required: ["intents"],
  additionalProperties: false,
};

export function createEditorTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "editor",
    description: TOOL_COPY.editor.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const intents = requireStringArray(args, 'intents');

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const adapter = createEngineAdapter(config, deps);
      return delegateIntents(adapter, editorRole, "Editor", intents);
    },
  };
}
