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
      const patternResult = optionalString(args, 'pattern');
      if (patternResult._tag === 'Err') return patternResult.error;
      const pathResult = optionalString(args, 'path');
      if (pathResult._tag === 'Err') return pathResult.error;
      const excludeResult = optionalString(args, 'exclude');
      if (excludeResult._tag === 'Err') return excludeResult.error;
      const caseSensitiveResult = optionalBoolean(args, 'caseSensitive');
      if (caseSensitiveResult._tag === 'Err') return caseSensitiveResult.error;
      const contextResult = optionalNumber(args, 'context');
      if (contextResult._tag === 'Err') return contextResult.error;
      const limitResult = optionalNumber(args, 'limit');
      if (limitResult._tag === 'Err') return limitResult.error;
      const iteratorResult = optionalString(args, 'iterator');
      if (iteratorResult._tag === 'Err') return iteratorResult.error;
      const result = await fuzzyGrep(
        {
          pattern: patternResult.value,
          path: pathResult.value,
          exclude: excludeResult.value,
          caseSensitive: caseSensitiveResult.value,
          context: contextResult.value,
          limit: limitResult.value,
          iterator: iteratorResult.value,
        },
        { cwd: config.cwd, scopeId: config.workspaceId ?? "global" }
      );
      return result.output;
    },
  };
}
