import { FuzzySearchCoordinator, resolveExternalBasePath } from 'engine/fuzzy';
import { globalIteratorStore } from 'engine/util';

const FUZZY_FIND_DESCRIPTION = `Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.

First call: provide pattern and optional path.
Later calls: provide only iterator.
Every result ends with iterator="..."; iteration is finished when it becomes iterator="".`;

const FUZZY_GREP_DESCRIPTION = `Search file contents using fuzzy-aware content search. Smart-case, git-aware, frecency-ranked. Supports automatic regex mode for regex-like patterns and automatic fuzzy fallback when no exact matches are found.

First call: provide pattern and optional filters.
Later calls: provide only iterator.
Every result ends with iterator="..."; iteration is finished when it becomes iterator="".`;

export function createFuzzyFindTool(pi) {
  return {
    name: 'fuzzy_find',
    label: 'Fuzzy Find',
    description: FUZZY_FIND_DESCRIPTION,
    parameters: pi.typebox.Object({
      pattern: pi.typebox.Optional(pi.typebox.String({ description: "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported." })),
      path: pi.typebox.Optional(pi.typebox.String({ description: 'Initial optional path constraint to narrow search scope' })),
      limit: pi.typebox.Optional(pi.typebox.Number({ description: 'Maximum number of results to return per call (default: 30)' })),
      iterator: pi.typebox.Optional(pi.typebox.String({ description: 'Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field. Iteration is finished when the result shows iterator="".' })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await FuzzySearchCoordinator.fuzzyFind(params, { cwd: ctx.cwd, scopeId: ctx.workspaceId ?? 'global' });
      return {
        content: [{ type: 'text', text: result.output }],
        isError: result.isError,
      };
    },
  };
}

export function createFuzzyGrepTool(pi) {
  return {
    name: 'fuzzy_grep',
    label: 'Fuzzy Grep',
    description: FUZZY_GREP_DESCRIPTION,
    parameters: pi.typebox.Object({
      pattern: pi.typebox.Optional(pi.typebox.String({ description: 'Initial search pattern. Required on the first call. Supports literal text and regex-like patterns.' })),
      path: pi.typebox.Optional(pi.typebox.String({ description: "Initial path constraint (repo-relative or absolute path outside workspace). Use 'src/' or '*.ts' to narrow the first call." })),
      exclude: pi.typebox.Optional(pi.typebox.Union([
        pi.typebox.String({ description: "Initial exclude paths (e.g. 'test/,*.min.js')" }),
        pi.typebox.Array(pi.typebox.String({ description: 'Initial exclude path or glob' })),
      ])),
      caseSensitive: pi.typebox.Optional(pi.typebox.Boolean({ description: 'Initial case-sensitivity override (smart-case by default - case-insensitive when pattern is all lowercase)' })),
      context: pi.typebox.Optional(pi.typebox.Number({ description: 'Initial number of context lines before and after each match' })),
      limit: pi.typebox.Optional(pi.typebox.Number({ description: 'Maximum number of matches to return per call.' })),
      iterator: pi.typebox.Optional(pi.typebox.String({ description: 'Opaque single-use iterator from a previous fuzzy_grep result. On continuation, pass only this field. Iteration is finished when the result shows iterator="".' })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await FuzzySearchCoordinator.fuzzyGrep(params, { cwd: ctx.cwd, scopeId: ctx.workspaceId ?? 'global' });
      return {
        content: [{ type: 'text', text: result.output }],
        isError: result.isError,
      };
    },
  };
}

export function resetFuzzyState() {
  globalIteratorStore.clear();
}

export const _test = {
  resetFuzzyState,
  storeCursor: (state) => globalIteratorStore.store('global', 'omp_c', state),
  consumeCursor: (id) => globalIteratorStore.consume(id),
  storeFindCursor: (state) => globalIteratorStore.store('global', 'omp_f', state),
  consumeFindCursor: (id) => globalIteratorStore.consume(id),
  resolveExternalBasePath,
};
