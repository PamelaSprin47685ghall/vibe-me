import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import type { Result } from 'engine';
import { TOOL_COPY } from 'engine/tool-copy';
import { formatOllamaWebError } from './error.js';
import { executeOllamaFetch, executeOllamaSearch } from './execute.js';
import type { OllamaWebDeps, OllamaWebError } from './types.js';

function unwrapResult(result: Result<string, OllamaWebError>): string {
  return result._tag === 'Ok'
    ? result.value
    : formatOllamaWebError(result.error);
}

export function createOllamaWebSearchTool(
  deps: Partial<OllamaWebDeps> = {},
): ToolDefinition {
  return tool({
    description: TOOL_COPY.websearch.description,
    args: {
      query: tool.schema.string().describe(TOOL_COPY.websearch.params.query),
      numResults: tool.schema
        .number()
        .int()
        .positive()
        .optional()
        .describe(TOOL_COPY.websearch.params.numResults),
    },
    execute: async (args, context) =>
      unwrapResult(await executeOllamaSearch(args, context, deps)),
  });
}

export function createOllamaWebFetchTool(
  deps: Partial<OllamaWebDeps> = {},
): ToolDefinition {
  return tool({
    description: TOOL_COPY.webfetch.description,
    args: {
      url: tool.schema.string().describe(TOOL_COPY.webfetch.params.url),
      extract_main: tool.schema
        .boolean()
        .optional()
        .describe(TOOL_COPY.webfetch.params.extract_main),
      prefer_llms_txt: tool.schema
        .enum(['auto', 'always', 'never'])
        .optional()
        .describe(TOOL_COPY.webfetch.params.prefer_llms_txt),
      prompt: tool.schema
        .string()
        .optional()
        .describe(TOOL_COPY.webfetch.params.prompt),
      timeout: tool.schema
        .number()
        .optional()
        .describe(TOOL_COPY.webfetch.params.timeout),
    },
    execute: async (args, context) =>
      unwrapResult(await executeOllamaFetch(args, context, deps)),
  });
}
