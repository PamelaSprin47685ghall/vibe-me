import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';

import {
  formatFetchResponse as defaultFormatFetchResponse,
  formatSearchResults as defaultFormatSearchResults,
  ollamaPost as defaultOllamaPost,
  validateFetchUrl as defaultValidateFetchUrl,
} from 'engine/ollama';
import { TOOL_COPY } from 'engine/tool-copy';

type OllamaPost = (
  pathname: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;

type ValidateFetchUrl = (url: string) => Promise<string | null>;

type FormatFetchResponse = (data: {
  title?: string;
  byline?: string;
  length?: number;
  content?: string;
}) => string;

type FormatSearchResults = (
  results: Array<{ title: string; url: string; content: string }>,
) => string;

export type OllamaWebDeps = {
  ollamaPost: OllamaPost;
  validateFetchUrl: ValidateFetchUrl;
  formatFetchResponse: FormatFetchResponse;
  formatSearchResults: FormatSearchResults;
};

type WebSearchArgs = { query: string; numResults?: number };

type WebFetchArgs = {
  url: string;
  extract_main?: boolean;
  prefer_llms_txt?: string;
  prompt?: string;
  timeout?: number;
};

type ToolContext = { abort: AbortSignal };

function resolveDeps(partial: Partial<OllamaWebDeps> = {}): OllamaWebDeps {
  return {
    ollamaPost: partial.ollamaPost ?? defaultOllamaPost,
    validateFetchUrl: partial.validateFetchUrl ?? defaultValidateFetchUrl,
    formatFetchResponse:
      partial.formatFetchResponse ?? defaultFormatFetchResponse,
    formatSearchResults:
      partial.formatSearchResults ?? defaultFormatSearchResults,
  };
}

export async function executeOllamaSearch(
  args: WebSearchArgs,
  context: ToolContext,
  deps: Partial<OllamaWebDeps> = {},
): Promise<string> {
  const resolved = resolveDeps(deps);
  try {
    const data = (await resolved.ollamaPost(
      '/web_search',
      { query: args.query, max_results: args.numResults ?? 10 },
      context.abort,
    )) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };
    return (
      resolved.formatSearchResults(data.results ?? []) || 'No results found.'
    );
  } catch (error) {
    if (context.abort.aborted) return 'Request was cancelled';
    return `Search failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

export async function executeOllamaFetch(
  args: WebFetchArgs,
  context: ToolContext,
  deps: Partial<OllamaWebDeps> = {},
): Promise<string> {
  const resolved = resolveDeps(deps);
  const validationError = await resolved.validateFetchUrl(args.url);
  if (validationError) return validationError;

  try {
    const data = (await resolved.ollamaPost(
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
    return resolved.formatFetchResponse(data);
  } catch (error) {
    if (context.abort.aborted) return 'Request was cancelled';
    return `Fetch failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
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
    execute: (args, context) => executeOllamaSearch(args, context, deps),
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
    execute: (args, context) => executeOllamaFetch(args, context, deps),
  });
}
