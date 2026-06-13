import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireIntentTuples } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { editorRole, delegateIntents, formatEditorIntent } from "engine";
import { createEngineAdapter } from "./engine-adapter.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intents: {
      type: "array",
      items: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [
          { type: "string", description: "The code-change intent." },
          { type: "array", items: { type: "string" }, description: "The list of affected files." },
        ],
      },
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
      const intentsResult = requireIntentTuples(args, 'intents');
      if (intentsResult._tag === 'Err') return intentsResult.error;
      const intents = intentsResult.value;

      if (intents.length === 0) {
        return "Error: `intents` must be a non-empty array.";
      }

      const prompts = intents.map(([intent, affectedFiles]) =>
        formatEditorIntent(intent, affectedFiles)
      );

      const adapter = createEngineAdapter(config, deps);
      return delegateIntents(adapter, editorRole, "Editor", prompts);
    },
  };
}
