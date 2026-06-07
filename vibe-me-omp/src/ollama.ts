import {
  formatFetchResponse,
  formatSearchResults,
  getOllamaApiKey,
  ollamaPost,
  validateFetchUrl,
} from 'engine/ollama';
import type { PiLike, SharedHelpers, ToolResult } from './shared.js';

export const OLLAMA_TOOL_NAMES = ['websearch', 'webfetch'];

export function getOllamaKey() {
  return getOllamaApiKey();
}

export function registerOllamaTools(pi: PiLike, helpers: Pick<SharedHelpers, 'asErrorResult'>) {
  const { asErrorResult } = helpers;

  pi.registerTool({
    name: 'websearch',
    label: 'Ollama Search',
    description: 'Search the web using Ollama web search.',
    parameters: pi.typebox.Type.Object({
      query: pi.typebox.Type.String({ description: 'Natural language search query.' }),
      numResults: pi.typebox.Type.Optional(pi.typebox.Type.Number({ description: 'Maximum results to return.' })),
    }),
    async execute(_toolCallId: string, params: { query: string; numResults?: number }, signal: AbortSignal | undefined): Promise<ToolResult> {
      try {
        const data = await ollamaPost('/web_search', { query: params.query, max_results: params.numResults ?? 10 }, signal);
        return { content: [{ type: 'text', text: formatSearchResults((data.results || []) as Array<{ title: string; url: string; content: string }>) }], details: data };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'webfetch',
    label: 'Ollama Fetch',
    description: 'Fetch URL content using Ollama web fetch.',
    parameters: pi.typebox.Type.Object({
      url: pi.typebox.Type.String({ description: 'URL to fetch.' }),
      extract_main: pi.typebox.Type.Optional(pi.typebox.Type.Boolean({ description: 'Whether to extract main content.' })),
      prefer_llms_txt: pi.typebox.Type.Optional(pi.typebox.Type.String({ description: 'auto, always, or never.' })),
      prompt: pi.typebox.Type.Optional(pi.typebox.Type.String({ description: 'Optional extraction task.' })),
      timeout: pi.typebox.Type.Optional(pi.typebox.Type.Number({ description: 'Timeout in seconds.' })),
    }),
    async execute(_toolCallId: string, params: { url: string; extract_main?: boolean; prefer_llms_txt?: string; prompt?: string; timeout?: number }, signal: AbortSignal | undefined): Promise<ToolResult> {
      try {
        const urlError = await validateFetchUrl(params.url);
        if (urlError) return asErrorResult(new Error(urlError));
        const data = await ollamaPost('/web_fetch', {
          url: params.url,
          extract_main: params.extract_main ?? true,
          prefer_llms_txt: params.prefer_llms_txt ?? 'auto',
          prompt: params.prompt,
          timeout: params.timeout,
        }, signal);
        return { content: [{ type: 'text', text: formatFetchResponse(data) }], details: data };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });
}
