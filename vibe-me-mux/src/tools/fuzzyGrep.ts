import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { optionalString, optionalBoolean, optionalNumber } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { fuzzyGrep } from "engine/fuzzy";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description:
        "Initial search pattern. Required on the first call. Supports literal text and regex-like patterns.",
    },
    path: {
      type: "string",
      description:
        "Initial path constraint (repo-relative or absolute path outside workspace). Use 'src/' or '*.ts' to narrow the first call.",
    },
    exclude: {
      type: "string",
      description: "Initial exclude paths (e.g. 'test/,*.min.js')",
    },
    caseSensitive: {
      type: "boolean",
      description: "Initial case-sensitivity override (smart-case by default)",
    },
    context: {
      type: "number",
      description: "Initial number of context lines before and after each match",
    },
    limit: {
      type: "number",
      description: "Maximum number of matches to return per call",
    },
    iterator: {
      type: "string",
      description:
        "Opaque single-use iterator from a previous fuzzy_grep result. On continuation, pass only this field.",
    },
  },
  additionalProperties: false,
};

export function createFuzzyGrepTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "fuzzy_grep",
    description:
      "Search file contents using fuzzy-aware content search. Smart-case, git-aware, frecency-ranked. Supports automatic regex mode for regex-like patterns and automatic fuzzy fallback when no exact matches are found.\n\nFirst call: provide pattern and optional filters.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
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
