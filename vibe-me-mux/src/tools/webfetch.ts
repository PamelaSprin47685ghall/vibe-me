import type { JsonSchema, PluginToolArgs, ToolDefinition, WebfetchToolArgs } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { ollamaPost } from "engine/ollama";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL to fetch",
    },
    extract_main: {
      type: "boolean",
      description:
        "Extract main content from the page, removing navigation, ads, etc. (default: true)",
    },
    prefer_llms_txt: {
      type: "string",
      enum: ["auto", "always", "never"],
      description: "Probe for llms.txt files before fetching full page (default: auto)",
    },
    prompt: {
      type: "string",
      description:
        "Optional extraction task to run on the fetched content using a cheap secondary model",
    },
    timeout: {
      type: "number",
      description: "Timeout in seconds (max: 120)",
    },
  },
  required: ["url"],
  additionalProperties: false,
};

export function createWebfetchTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "webfetch",
    description:
      "Fetch a URL with better extraction for static/docs pages. Supports llms.txt probing, content-focused HTML extraction, metadata, redirects, and an optional prompt processed by a cheap secondary model.",
    parameters,
    execute: async (_config, args: PluginToolArgs) => {
      const a = args as WebfetchToolArgs;
      const fetchBody: Record<string, unknown> = { url: a.url };
      if (a.extract_main != null) fetchBody.extract_main = a.extract_main;
      if (a.prefer_llms_txt != null)
        fetchBody.prefer_llms_txt = a.prefer_llms_txt;
      if (a.prompt != null) fetchBody.prompt = a.prompt;
      if (a.timeout != null) fetchBody.timeout = a.timeout;

      try {
        const data = await ollamaPost("web_fetch", fetchBody);
        return JSON.stringify({ success: true, data });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          success: false,
          error: `Web fetch failed: ${message}`,
        });
      }
    },
  };
}
