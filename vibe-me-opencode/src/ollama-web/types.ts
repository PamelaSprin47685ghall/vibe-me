import {
  formatFetchResponse as defaultFormatFetchResponse,
  formatSearchResults as defaultFormatSearchResults,
  ollamaPost as defaultOllamaPost,
  validateFetchUrl as defaultValidateFetchUrl,
} from 'engine/ollama';

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

export type OllamaWebError =
  | { readonly _tag: 'Cancelled' }
  | { readonly _tag: 'ValidationError'; readonly message: string }
  | { readonly _tag: 'UnexpectedError'; readonly message: string };

export type WebSearchArgs = { query: string; numResults?: number };

export type WebFetchArgs = {
  url: string;
  extract_main?: boolean;
  prefer_llms_txt?: string;
  prompt?: string;
  timeout?: number;
};

export type ToolContext = { abort: AbortSignal };

export function resolveDeps(
  partial: Partial<OllamaWebDeps> = {},
): OllamaWebDeps {
  return {
    ollamaPost: partial.ollamaPost ?? defaultOllamaPost,
    validateFetchUrl: partial.validateFetchUrl ?? defaultValidateFetchUrl,
    formatFetchResponse:
      partial.formatFetchResponse ?? defaultFormatFetchResponse,
    formatSearchResults:
      partial.formatSearchResults ?? defaultFormatSearchResults,
  };
}
