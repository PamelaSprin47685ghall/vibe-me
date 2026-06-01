import { tool } from "ai";
import { z } from "zod";
import { ollamaPost, formatSearchResults } from "engine/ollama";
import type { ToolConfiguration, ToolFactory } from "../types/tool";

const WebsearchToolInputSchema = z.object({
  query: z.string().describe("Natural language search query..."),
  numResults: z.number().int().positive().nullish().describe("Number of search results to return (default: 10)"),
});

interface SearchResultItem {
  title?: string;
  url?: string;
  content?: string;
}

export const createWebsearchTool: ToolFactory = (_config: ToolConfiguration) => {
  return tool({
    description:
      "Search the web for any topic and get clean, ready-to-use content.\n\nBest for: Finding current information, news, facts, people, companies, or answering questions about any topic.\nReturns: Clean text content from top search results.\n\nQuery tips:\ndescribe the ideal page, not keywords. \"blog post comparing React and Vue performance\" not \"React vs Vue\".\nUse category:people / category:company to search through Linkedin profiles / companies respectively.",
    inputSchema: WebsearchToolInputSchema,
    execute: async (args) => {
      try {
        const data = (await ollamaPost("web_search", {
          query: args.query,
          max_results: args.numResults ?? 10,
        })) as { results?: SearchResultItem[] };
        return formatSearchResults(
          (data.results ?? []).map((r) => ({
            title: r.title ?? "",
            url: r.url ?? "",
            content: r.content ?? "",
          })),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JSON.stringify({ success: false, error: `Web search failed: ${message}` });
      }
    },
  });
};
