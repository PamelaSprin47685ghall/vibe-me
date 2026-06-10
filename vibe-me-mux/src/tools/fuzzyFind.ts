import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface FuzzyFindToolArgs {
  readonly pattern?: string;
  readonly path?: string;
  readonly limit?: number;
  readonly iterator?: string;
}
import type { HostDependencies } from "../types/deps.js";
import { fuzzyFind } from "engine/fuzzy";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description:
        "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported.",
    },
    path: {
      type: "string",
      description: "Initial optional path constraint to narrow search scope",
    },
    limit: {
      type: "number",
      description: "Maximum number of results to return per call (default: 30)",
    },
    iterator: {
      type: "string",
      description:
        "Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field.",
    },
  },
  additionalProperties: false,
};

export function createFuzzyFindTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "fuzzy_find",
    description:
      "Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.\n\nFirst call: provide pattern and optional path.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const a = args as unknown as FuzzyFindToolArgs;
      const result = await fuzzyFind(
        {
          pattern: a.pattern ?? undefined,
          path: a.path ?? undefined,
          limit: a.limit ?? undefined,
          iterator: a.iterator ?? undefined,
        },
        { cwd: config.cwd, scopeId: config.workspaceId ?? "global" }
      );
      return result.output;
    },
  };
}
