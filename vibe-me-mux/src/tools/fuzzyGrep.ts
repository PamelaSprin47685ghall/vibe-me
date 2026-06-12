import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { optionalString, optionalBoolean, optionalNumber } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { fuzzyGrep } from "engine/fuzzy";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description: TOOL_COPY.fuzzy_grep.params.pattern,
    },
    path: {
      type: "string",
      description: TOOL_COPY.fuzzy_grep.params.path,
    },
    exclude: {
      type: "string",
      description: TOOL_COPY.fuzzy_grep.params.exclude,
    },
    caseSensitive: {
      type: "boolean",
      description: TOOL_COPY.fuzzy_grep.params.caseSensitive,
    },
    context: {
      type: "number",
      description: TOOL_COPY.fuzzy_grep.params.context,
    },
    limit: {
      type: "number",
      description: TOOL_COPY.fuzzy_grep.params.limit,
    },
    iterator: {
      type: "string",
      description: TOOL_COPY.fuzzy_grep.params.iterator,
    },
  },
  additionalProperties: false,
};

export function createFuzzyGrepTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "fuzzy_grep",
    description: TOOL_COPY.fuzzy_grep.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const pattern = optionalString(args, 'pattern');
      const path = optionalString(args, 'path');
      const exclude = optionalString(args, 'exclude');
      const caseSensitive = optionalBoolean(args, 'caseSensitive');
      const context = optionalNumber(args, 'context');
      const limit = optionalNumber(args, 'limit');
      const iterator = optionalString(args, 'iterator');
      const result = await fuzzyGrep(
        {
          pattern,
          path,
          exclude,
          caseSensitive,
          context,
          limit,
          iterator,
        },
        { cwd: config.cwd, scopeId: config.workspaceId ?? "global" }
      );
      return result.output;
    },
  };
}
