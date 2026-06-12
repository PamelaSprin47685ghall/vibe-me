import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString, requireStringArray } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { reverieRole, buildReveriePrompt } from "engine";
import { createEngineAdapter } from "./engine-adapter.js";
import { readReverieFiles } from "engine/reverie-files";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: TOOL_COPY.reverie.params.intent,
    },
    files: {
      type: "array",
      items: {
        type: "string",
        description: TOOL_COPY.reverie.params.files,
      },
      description: TOOL_COPY.reverie.params.files,
    },
  },
  required: ["intent", "files"],
  additionalProperties: false,
};

export function createReverieTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "reverie",
    description: TOOL_COPY.reverie.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const intent = requireString(args, 'intent');
      const files = requireStringArray(args, 'files');
      const readResults = await readReverieFiles(config.cwd, files);
      const sections = files.map((file, i) => ({ file, content: readResults[i]?.content }));
      const prompt = buildReveriePrompt(sections, intent);
      const adapter = createEngineAdapter(config, deps);
      return adapter.promptSubagent({ role: reverieRole, prompt, title: "Reverie" });
    },
  };
}
