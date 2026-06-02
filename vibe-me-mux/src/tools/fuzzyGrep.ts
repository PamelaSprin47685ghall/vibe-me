import type { SchemaFactory, ToolDefinition, FuzzyGrepToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { FuzzySearchCoordinator } from "engine/fuzzy";

export function createFuzzyGrepTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    pattern: f.string(
      "Initial search pattern. Required on the first call. Supports literal text and regex-like patterns.",
    ),
    path: f.string(
      "Initial path constraint (repo-relative or absolute path outside workspace). Use 'src/' or '*.ts' to narrow the first call.",
    ),
    exclude: f.string(
      "Initial exclude paths (e.g. 'test/,*.min.js')",
    ),
    caseSensitive: f.boolean(
      "Initial case-sensitivity override (smart-case by default)",
    ),
    context: f.number(
      "Initial number of context lines before and after each match",
    ),
    limit: f.number(
      "Maximum number of matches to return per call",
    ),
    iterator: f.string(
      "Opaque single-use iterator from a previous fuzzy_grep result. On continuation, pass only this field.",
    ),
  });

  return {
    name: "fuzzy_grep",
    description:
      "Search file contents using fuzzy-aware content search. Smart-case, git-aware, frecency-ranked. Supports automatic regex mode for regex-like patterns and automatic fuzzy fallback when no exact matches are found.\n\nFirst call: provide pattern and optional filters.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as FuzzyGrepToolArgs;
      const result = await FuzzySearchCoordinator.fuzzyGrep(
        {
          pattern: a.pattern ?? undefined,
          path: a.path ?? undefined,
          exclude: a.exclude ?? undefined,
          caseSensitive: a.caseSensitive ?? undefined,
          context: a.context ?? undefined,
          limit: a.limit ?? undefined,
          iterator: a.iterator ?? undefined,
        },
        { cwd: config.cwd, scopeId: config.workspaceId ?? "global" }
      );
      return result.output;
    },
  };
}
