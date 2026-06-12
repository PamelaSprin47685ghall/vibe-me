import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString, optionalNumber } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { ollamaPost, formatSearchResults } from "engine/ollama";

interface SearchResultItem {
  title?: string;
  url?: string;
  content?: string;
}

const parameters: JsonSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: TOOL_COPY.websearch.params.query,
    },
    numResults: {
      type: "number",
      description: TOOL_COPY.websearch.params.numResults,
    },
  },
  required: ["query"],
  additionalProperties: false,
};

export function createWebsearchTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "websearch",
    description: TOOL_COPY.websearch.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const query = requireString(args, 'query');
      const numResults = optionalNumber(args, 'numResults');
      try {
        const data = (await ollamaPost("web_search", {
          query,
          max_results: numResults ?? 10,
        }, config.abortSignal)) as { results?: SearchResultItem[] };
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
