import path from "node:path";
import type { SchemaFactory, ToolDefinition, FuzzyGrepToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import type { GrepCursor, GrepMode, GrepResult } from "@ff-labs/fff-node";
import {
  fileAnnotation as fffFileAnnotation,
  truncateLine,
  getFffModule,
  FinderManager,
  buildQuery,
  storeIterator,
  consumeIterator,
} from "engine/fuzzy";

function formatGrepOutput(
  result: Pick<GrepResult, "items" | "totalMatched">,
): string {
  try {
    if (!result?.items?.length) return "No matches found";
    const totalMatched = result.totalMatched ?? result.items.length;
    const lines: string[] = [
      `${totalMatched} match${totalMatched === 1 ? "" : "es"}`,
      "",
    ];
    let currentFile = "";
    for (const match of result.items) {
      if (!match) continue;
      if (match.relativePath !== currentFile) {
        if (lines.length > 0) lines.push("");
        currentFile = match.relativePath;
        lines.push(`${currentFile}${fffFileAnnotation(match)}`);
      }
      match.contextBefore?.forEach((line: string, i: number) => {
        const ctxLen = match.contextBefore?.length ?? 0;
        const lineNum = match.lineNumber - ctxLen + i;
        lines.push(` ${lineNum}- ${truncateLine(line)}`);
      });
      lines.push(` ${match.lineNumber}: ${truncateLine(match.lineContent)}`);
      match.contextAfter?.forEach((line: string, i: number) => {
        const lineNum = match.lineNumber + 1 + i;
        lines.push(` ${lineNum}- ${truncateLine(line)}`);
      });
    }
    return lines.join("\n");
  } catch {
    return "(error formatting grep output)";
  }
}

interface GrepIteratorState {
  query: string;
  mode: GrepMode;
  smartCase: boolean;
  beforeContext: number;
  afterContext: number;
  pageSize: number;
  externalBasePath: string | null;
  cursor: GrepCursor | null;
}

function resolveExternalBasePath(absPath: string): {
  basePath: string;
  pathConstraint: string | null;
} {
  const normalized = path.resolve(absPath);
  const lastSegment = normalized.split(path.sep).pop() ?? "";
  if (
    lastSegment.startsWith(".") ||
    /\.[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(lastSegment)
  ) {
    return {
      basePath: path.dirname(normalized),
      pathConstraint: lastSegment,
    };
  }
  return { basePath: normalized, pathConstraint: null };
}

async function createExternalFinder(basePath: string) {
  const { FileFinder } = await getFffModule();
  const result = FileFinder.create({ basePath, aiMode: true });
  if (!result.ok) {
    throw new Error(`Failed to create FFF file finder: ${result.error}`);
  }
  const finder = result.value;
  try {
    await finder.waitForScan(15000);
  } catch {
    // scan timeout is non-fatal
  }
  return finder;
}

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
      const external: { f: { destroy(): void } | null } = { f: null };
      try {
        const activeCwd = config.cwd;
        let searchState: GrepIteratorState | undefined = a.iterator
          ? consumeIterator<GrepIteratorState>(a.iterator)
          : undefined;

        if (!searchState) {
          if (a.iterator) {
            return `fuzzy_grep iterator error: unknown, expired, or already consumed iterator "${a.iterator}"`;
          }
          if (!a.pattern) {
            return "pattern is required on the first call";
          }

          let externalBasePath: string | null = null;
          let externalPathConstraint: string | null = null;
          if (a.path && path.isAbsolute(a.path)) {
            const info = resolveExternalBasePath(path.resolve(a.path));
            externalBasePath = info.basePath;
            externalPathConstraint = info.pathConstraint;
          }

          const query = buildQuery(
            externalBasePath ? externalPathConstraint : a.path,
            a.pattern,
            a.exclude,
            externalBasePath ?? activeCwd,
            !!externalBasePath,
          );

          const hasRegexSyntax =
            a.pattern !== a.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          let mode: GrepMode = hasRegexSyntax ? "regex" : "plain";
          if (mode === "regex") {
            try {
              new RegExp(a.pattern);
            } catch {
              mode = "plain";
            }
          }

          const trimmed = a.pattern.trim();
          const isWildcardOnly =
            hasRegexSyntax &&
            /^(?:[.^$]*(?:[.][*+?]|\*|\+)[.^$]*|[.^$\s]*|\.\*\??|\.\*[+?]?|\.\+\??|\.|\*|\?)$/.test(
              trimmed,
            );
          if (isWildcardOnly) {
            return `Pattern '${a.pattern}' matches everything - fuzzy_grep needs a concrete substring or identifier.`;
          }

          searchState = {
            query,
            mode,
            smartCase: a.caseSensitive !== true,
            beforeContext: a.context ?? 0,
            afterContext: a.context ?? 0,
            pageSize: a.limit ?? 50,
            externalBasePath,
            cursor: null,
          };
        }

        const externalBasePath = searchState.externalBasePath;
        const f2 = externalBasePath
          ? await (async () => {
              const finder = await createExternalFinder(externalBasePath);
              external.f = finder;
              return finder;
            })()
          : await FinderManager.get(activeCwd);

        const grepResult = f2.grep(searchState.query, {
          mode: searchState.mode,
          smartCase: searchState.smartCase,
          maxMatchesPerFile: Math.min(searchState.pageSize, 50),
          pageSize: searchState.pageSize,
          cursor: searchState.cursor,
          beforeContext: searchState.beforeContext,
          afterContext: searchState.afterContext,
          classifyDefinitions: true,
        });
        if (!grepResult?.ok) {
          throw new Error(grepResult?.error ?? "fuzzy_grep failed");
        }

        let result = grepResult.value;
        let fuzzyNotice: string | null = null;
        if (
          !result?.items?.length &&
          !a.iterator &&
          searchState.mode !== "regex"
        ) {
          try {
            const fuzzy = f2.grep(searchState.query, {
              mode: "fuzzy",
              smartCase: searchState.smartCase,
              maxMatchesPerFile: Math.min(searchState.pageSize, 50),
              pageSize: searchState.pageSize,
              cursor: null,
              beforeContext: 0,
              afterContext: 0,
              classifyDefinitions: true,
            });
            if (fuzzy?.ok && fuzzy.value?.items?.length) {
              fuzzyNotice = "0 exact matches. Maybe you meant this?";
              result = fuzzy.value;
              searchState = {
                ...searchState,
                mode: "fuzzy",
                beforeContext: 0,
                afterContext: 0,
                cursor: null,
              };
            }
          } catch {
            // fuzzy fallback best-effort
          }
        }

        let output = formatGrepOutput(result);
        const notices: string[] = [];
        if (result?.regexFallbackError) {
          notices.push(
            `Invalid regex: ${result.regexFallbackError}, used literal match`,
          );
        }
        notices.push(
          `iterator="${
            result?.nextCursor
              ? storeIterator("ffi_i", {
                  ...searchState,
                  cursor: result.nextCursor,
                })
              : ""
          }"`,
        );
        if (notices.length > 0) output += `\n\n[${notices.join(". ")}]`;
        if (fuzzyNotice) output = `[${fuzzyNotice}]\n${output}`;

        return output;
      } catch (err) {
        return `fuzzy_grep error: ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        if (external.f) {
          try {
            external.f.destroy();
          } catch {
            // cleanup best-effort
          }
        }
      }
    },
  };
}
