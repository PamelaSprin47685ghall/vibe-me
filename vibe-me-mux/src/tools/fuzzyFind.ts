import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { optionalString, optionalNumber } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { fuzzyFind } from "engine/fuzzy";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description: TOOL_COPY.fuzzy_find.params.pattern,
    },
    path: {
      type: "string",
      description: TOOL_COPY.fuzzy_find.params.path,
    },
    limit: {
      type: "number",
      description: TOOL_COPY.fuzzy_find.params.limit,
    },
    iterator: {
      type: "string",
      description: TOOL_COPY.fuzzy_find.params.iterator,
    },
  },
  additionalProperties: false,
};

export function createFuzzyFindTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "fuzzy_find",
    description: TOOL_COPY.fuzzy_find.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const pattern = optionalString(args, 'pattern');
      const path = optionalString(args, 'path');
      const limit = optionalNumber(args, 'limit');
      const iterator = optionalString(args, 'iterator');
      const result = await fuzzyFind(
        {
          pattern,
          path,
          limit,
          iterator,
        },
        { cwd: config.cwd, scopeId: config.workspaceId ?? "global" }
      );
      return result.output;
    },
  };
}
