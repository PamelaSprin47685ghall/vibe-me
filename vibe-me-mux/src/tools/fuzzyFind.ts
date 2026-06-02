import type { SchemaFactory, ToolDefinition, FuzzyFindToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import {
  fileAnnotation as fffFileAnnotation,
  FinderManager,
  buildQuery,
  storeIterator,
  consumeIterator,
} from "engine/fuzzy";

interface FuzzyFindIteratorState {
  query: string;
  pageSize: number;
  pageIndex: number;
}

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
      try {
        const finder = await FinderManager.get(config.cwd);
        let searchState: FuzzyFindIteratorState | undefined = a.iterator
          ? consumeIterator<FuzzyFindIteratorState>(a.iterator)
          : undefined;

        if (!searchState) {
          if (a.iterator) {
            return `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${a.iterator}"`;
          }
          if (!a.pattern) {
            return "pattern is required on the first call";
          }

          searchState = {
            query: buildQuery(a.path, a.pattern, undefined, config.cwd),
            pageSize: a.limit ?? 30,
            pageIndex: 0,
          };
        }

        const findResult = finder.fileSearch(searchState.query, {
          pageSize: searchState.pageSize,
          pageIndex: searchState.pageIndex,
        });

        if (!findResult?.ok) {
          throw new Error(findResult?.error ?? "fuzzy_find failed");
        }

        const searchResult = findResult.value;
        if (!searchResult?.items?.length) {
          return `No matching files found\n\n[iterator=""]`;
        }

        const lines: string[] = [
          `${searchResult.totalMatched} matching file${searchResult.totalMatched === 1 ? "" : "s"} (${searchResult.totalFiles} total indexed)`,
          "",
        ];

        for (const item of searchResult.items) {
          const annotation = fffFileAnnotation({
            totalFrecencyScore: item.totalFrecencyScore,
            gitStatus: item.gitStatus,
            accessFrecencyScore: 0,
          });
          lines.push(`${item.relativePath}${annotation}`);
        }

        let output = lines.join("\n");
        const notices: string[] = [];
        const nextPageIndex = searchState.pageIndex + 1;
        notices.push(
          `iterator="${
            searchResult.totalMatched > nextPageIndex * searchState.pageSize
              ? storeIterator("ffi_f", {
                  ...searchState,
                  pageIndex: nextPageIndex,
                })
              : ""
          }"`,
        );
        if (notices.length > 0) output += `\n\n[${notices.join(". ")}]`;

        return output;
      } catch (err) {
        return `fuzzy_find error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
