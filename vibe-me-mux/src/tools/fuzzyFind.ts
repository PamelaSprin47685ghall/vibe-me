import type { SchemaFactory, ToolDefinition, FuzzyFindToolArgs, PluginToolArgs } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { FuzzySearchCoordinator } from "engine/fuzzy";

export function createFuzzyFindTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    pattern: f.string(
      "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported.",
    ),
    path: f.string(
      "Initial optional path constraint to narrow search scope",
    ),
    limit: f.number(
      "Maximum number of results to return per call (default: 30)",
    ),
    iterator: f.string(
      "Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field.",
    ),
  });

  return {
    name: "fuzzy_find",
    description:
      "Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.\n\nFirst call: provide pattern and optional path.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as FuzzyFindToolArgs;
      const result = await FuzzySearchCoordinator.fuzzyFind(
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
