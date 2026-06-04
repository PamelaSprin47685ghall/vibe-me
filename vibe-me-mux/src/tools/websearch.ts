import type { SchemaFactory, ToolDefinition, WebsearchToolArgs, PluginToolArgs } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { ollamaPost, formatSearchResults } from "engine/ollama";

interface SearchResultItem {
  title?: string;
  url?: string;
  content?: string;
}

export function createWebsearchTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    query: f.string("Natural language search query..."),
    numResults: f.number(
      "Number of search results to return (default: 10)",
    ),
  });

  return {
    name: "websearch",
    description:
      "Search the web for any topic and get clean, ready-to-use content.\n\nBest for: Finding current information, news, facts, people, companies, or answering questions about any topic.\nReturns: Clean text content from top search results.\n\nQuery tips:\ndescribe the ideal page, not keywords. \"blog post comparing React and Vue performance\" not \"React vs Vue\".\nUse category:people / category:company to search through Linkedin profiles / companies respectively.",
    schema,
    execute: async (_config, args: PluginToolArgs) => {
      const { query, numResults } = args as WebsearchToolArgs;
      try {
        const data = (await ollamaPost("web_search", {
          query,
          max_results: numResults ?? 10,
        })) as { results?: SearchResultItem[] };
        return formatSearchResults(
          (data.results ?? []).map((r) => ({
            title: r.title ?? "",
            url: r.url ?? "",
            content: r.content ?? "",
          })),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          success: false,
          error: `Web search failed: ${message}`,
        });
      }
    },
  };
}
