import { tool } from "ai";
import { z } from "zod";

import type { ToolConfiguration, ToolFactory } from "../types/tool";

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



// ── Tool schema ──

const FuzzyFindInputSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .nullish()
    .describe(
      "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported.",
    ),
  path: z.string().nullish().describe("Initial optional path constraint to narrow search scope"),
  limit: z.number().int().min(1).nullish().describe("Maximum number of results to return per call (default: 30)"),
  iterator: z
    .string()
    .nullish()
    .describe(
      "Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field. Iteration is finished when the result shows iterator=\"\".",
    ),
});

// ── Tool factory ──

export const createFuzzyFindTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description:
      "Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.\n\nFirst call: provide pattern and optional path.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    inputSchema: FuzzyFindInputSchema,
    execute: async (args) => {
      try {
        const finder = await FinderManager.get(config.cwd);
        let searchState: FuzzyFindIteratorState | undefined = args.iterator
          ? consumeIterator<FuzzyFindIteratorState>(args.iterator)
          : undefined;

        if (!searchState) {
          if (args.iterator) {
            return `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${args.iterator}"`;
          }
          if (!args.pattern) {
            return "pattern is required on the first call";
          }

          searchState = {
            query: buildQuery(args.path, args.pattern, undefined, config.cwd),
            pageSize: args.limit ?? 30,
            pageIndex: 0,
          };
        }

        const result = finder.fileSearch(searchState.query, {
          pageSize: searchState.pageSize,
          pageIndex: searchState.pageIndex,
        });

        if (!result?.ok) {
          throw new Error(result?.error ?? "fuzzy_find failed");
        }

        const searchResult = result.value;
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
  });
};
