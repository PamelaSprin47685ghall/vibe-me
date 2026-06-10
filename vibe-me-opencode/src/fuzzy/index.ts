import { type ToolDefinition, tool } from '@opencode-ai/plugin';
import { fuzzyFind, fuzzyGrep, resolveExternalBasePath, resolveExternalPath } from 'engine/fuzzy';

export { resolveExternalBasePath, resolveExternalPath };

const z = tool.schema;

// -- Fuzzy find tool --

const FUZZY_FIND_DESCRIPTION = `Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.

First call: provide pattern and optional path.
Later calls: provide only iterator.
Every result ends with iterator="..."; iteration is finished when it becomes iterator="".`;

export function createFuzzyFindTool(): ToolDefinition {
  return tool({
    description: FUZZY_FIND_DESCRIPTION,
    args: {
      pattern: z
        .string()
        .min(1)
        .nullish()
        .describe(
          "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported.",
        ),
      path: z
        .string()
        .nullish()
        .describe('Initial optional path constraint to narrow search scope'),
      limit: z
        .number()
        .int()
        .min(1)
        .nullish()
        .describe('Maximum number of results to return per call (default: 30)'),
      iterator: z
        .string()
        .nullish()
        .describe(
          'Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field. Iteration is finished when the result shows iterator="".',
        ),
    },
    execute: async (args, context) => {
      const activeCwd = context.directory;
      const scopeId = context.sessionID;
      if (!scopeId) throw new Error("fuzzy_find requires an active session");
      const cleanArgs = {
        pattern: args.pattern ?? undefined,
        path: args.path ?? undefined,
        limit: args.limit ?? undefined,
        iterator: args.iterator ?? undefined,
      };
      const result = await fuzzyFind(cleanArgs, { cwd: activeCwd, scopeId });
      return result.output;
    },
  });
}

// -- Fuzzy grep tool --

const FUZZY_GREP_DESCRIPTION = `Search file contents using fuzzy-aware content search. Smart-case, git-aware, frecency-ranked. Supports automatic regex mode for regex-like patterns and automatic fuzzy fallback when no exact matches are found.

First call: provide pattern and optional filters.
Later calls: provide only iterator.
Every result ends with iterator="..."; iteration is finished when it becomes iterator="".`;

export function createFuzzyGrepTool(): ToolDefinition {
  return tool({
    description: FUZZY_GREP_DESCRIPTION,
    args: {
      pattern: z
        .string()
        .min(1)
        .nullish()
        .describe(
          'Initial search pattern. Required on the first call. Supports literal text and regex-like patterns.',
        ),
      path: z
        .string()
        .nullish()
        .describe(
          "Initial path constraint (repo-relative or absolute path outside workspace). Use 'src/' or '*.ts' to narrow the first call.",
        ),
      exclude: z
        .union([z.string(), z.array(z.string())])
        .nullish()
        .describe("Initial exclude paths (e.g. 'test/,*.min.js')"),
      caseSensitive: z
        .boolean()
        .nullish()
        .describe(
          'Initial case-sensitivity override (smart-case by default - case-insensitive when pattern is all lowercase)',
        ),
      context: z
        .number()
        .int()
        .min(0)
        .nullish()
        .describe('Initial number of context lines before and after each match'),
      limit: z
        .number()
        .int()
        .min(1)
        .nullish()
        .describe('Maximum number of matches to return per call'),
      iterator: z
        .string()
        .nullish()
        .describe(
          'Opaque single-use iterator from a previous fuzzy_grep result. On continuation, pass only this field. Iteration is finished when the result shows iterator="".',
        ),
    },
    execute: async (args, context) => {
      const activeCwd = context.directory;
      const scopeId = context.sessionID;
      if (!scopeId) throw new Error("fuzzy_grep requires an active session");
      const cleanArgs = {
        pattern: args.pattern ?? undefined,
        path: args.path ?? undefined,
        exclude: args.exclude ?? undefined,
        caseSensitive: args.caseSensitive ?? undefined,
        context: args.context ?? undefined,
        limit: args.limit ?? undefined,
        iterator: args.iterator ?? undefined,
      };
      const result = await fuzzyGrep(
        cleanArgs,
        { cwd: activeCwd, scopeId }
      );
      return result.output;
    },
  });
}
