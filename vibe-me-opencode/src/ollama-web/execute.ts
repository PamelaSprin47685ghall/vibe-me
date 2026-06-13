import { err, ok, type Result } from 'engine';
import type {
  OllamaWebDeps,
  OllamaWebError,
  ToolContext,
  WebFetchArgs,
  WebSearchArgs,
} from './types.js';
import { resolveDeps } from './types.js';

function toResult(output: string): Result<string, OllamaWebError> {
  return output ? ok(output) : ok('No results found.');
}

export async function executeOllamaSearch(
  args: WebSearchArgs,
  context: ToolContext,
  deps: Partial<OllamaWebDeps> = {},
): Promise<Result<string, OllamaWebError>> {
  const resolved = resolveDeps(deps);
  try {
    const data = (await resolved.ollamaPost(
      '/web_search',
      { query: args.query, max_results: args.numResults ?? 10 },
      context.abort,
    )) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };
    return toResult(resolved.formatSearchResults(data.results ?? []));
  } catch (error) {
    if (context.abort.aborted) return err({ _tag: 'Cancelled' });
    return err({
      _tag: 'UnexpectedError',
      message: `Search failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

export async function executeOllamaFetch(
  args: WebFetchArgs,
  context: ToolContext,
  deps: Partial<OllamaWebDeps> = {},
): Promise<Result<string, OllamaWebError>> {
  const resolved = resolveDeps(deps);
  const validationError = await resolved.validateFetchUrl(args.url);
  if (validationError)
    return err({ _tag: 'ValidationError', message: validationError });

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
    return ok(resolved.formatFetchResponse(data));
  } catch (error) {
    if (context.abort.aborted) return err({ _tag: 'Cancelled' });
    return err({
      _tag: 'UnexpectedError',
      message: `Fetch failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}
