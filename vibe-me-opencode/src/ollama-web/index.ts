import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';

import {
  formatFetchResponse,
  formatSearchResults,
  ollamaPost,
  validateFetchUrl,
} from 'engine/ollama';
import { TOOL_COPY } from 'engine/tool-copy';

const validateUrl = validateFetchUrl;

export function createOllamaWebSearchTool(): ToolDefinition {
  return tool({
    description: TOOL_COPY.websearch.description,
    args: {
      query: tool.schema
        .string()
        .describe(TOOL_COPY.websearch.params.query),
      numResults: tool.schema
        .number()
        .int()
        .positive()
        .optional()
        .describe(TOOL_COPY.websearch.params.numResults),
    },
    execute: async (
      args: { query: string; numResults?: number },
      context: { abort: AbortSignal },
    ) => {
      try {
        const data = (await ollamaPost(
          '/web_search',
          {
            query: args.query,
            max_results: args.numResults ?? 10,
          },
          context.abort,
        )) as {
          results?: Array<{ title: string; url: string; content: string }>;
        };
        const results = data.results ?? [];
        return formatSearchResults(results) || 'No results found.';
      } catch (error) {
        if (context.abort.aborted) {
          return 'Request was cancelled';
        }
        return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}

export function createOllamaWebFetchTool(): ToolDefinition {
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
    execute: async (
      args: {
        url: string;
        extract_main?: boolean;
        prefer_llms_txt?: string;
        prompt?: string;
        timeout?: number;
      },
      context: { abort: AbortSignal },
    ) => {
      const validationError = await validateUrl(args.url);
      if (validationError) return validationError;

      try {
        const data = (await ollamaPost(
          '/web_fetch',
          {
            url: args.url,
            extract_main: args.extract_main ?? true,
            prefer_llms_txt: args.prefer_llms_txt ?? 'auto',
            prompt: args.prompt,
            timeout: args.timeout,
          },
          context.abort,
        )) as {
          title?: string;
          byline?: string;
          length?: number;
          content?: string;
        };

        return formatFetchResponse(data);
      } catch (error) {
        if (context.abort.aborted) {
          return 'Request was cancelled';
        }
        return `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
