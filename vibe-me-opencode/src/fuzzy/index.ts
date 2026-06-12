import { type ToolDefinition, tool } from '@opencode-ai/plugin';
import { fuzzyFind, fuzzyGrep, resolveExternalBasePath, resolveExternalPath } from 'engine/fuzzy';
import { TOOL_COPY } from 'engine/tool-copy';

export { resolveExternalBasePath, resolveExternalPath };

const z = tool.schema;

// -- Fuzzy find tool --

export function createFuzzyFindTool(): ToolDefinition {
  return tool({
    description: TOOL_COPY.fuzzy_find.description,
    args: {
      pattern: z
        .string()
        .min(1)
        .nullish()
        .describe(TOOL_COPY.fuzzy_find.params.pattern),
      path: z
        .string()
        .nullish()
        .describe(TOOL_COPY.fuzzy_find.params.path),
      limit: z
        .number()
        .int()
        .min(1)
        .nullish()
        .describe(TOOL_COPY.fuzzy_find.params.limit),
      iterator: z
        .string()
        .nullish()
        .describe(TOOL_COPY.fuzzy_find.params.iterator),
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

export function createFuzzyGrepTool(): ToolDefinition {
  return tool({
    description: TOOL_COPY.fuzzy_grep.description,
    args: {
      pattern: z
        .string()
        .min(1)
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.pattern),
      path: z
        .string()
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.path),
      exclude: z
        .union([z.string(), z.array(z.string())])
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.exclude),
      caseSensitive: z
        .boolean()
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.caseSensitive),
      context: z
        .number()
        .int()
        .min(0)
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.context),
      limit: z
        .number()
        .int()
        .min(1)
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.limit),
      iterator: z
        .string()
        .nullish()
        .describe(TOOL_COPY.fuzzy_grep.params.iterator),
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
