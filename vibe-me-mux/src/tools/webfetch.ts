import type { SchemaFactory, ToolDefinition, WebfetchToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { ollamaPost } from "engine/ollama";

export function createWebfetchTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    url: f.string("The URL to fetch"),
    extract_main: f.boolean(
      "Extract main content from the page, removing navigation, ads, etc. (default: true)",
    ),
    prefer_llms_txt: f.enum(
      ["auto", "always", "never"] as const,
      "Probe for llms.txt files before fetching full page (default: auto)",
    ),
    prompt: f.string(
      "Optional extraction task to run on the fetched content using a cheap secondary model",
    ),
    timeout: f.number("Timeout in seconds (max: 120)"),
  });

  return {
    name: "webfetch",
    description:
      "Fetch a URL with better extraction for static/docs pages. Supports llms.txt probing, content-focused HTML extraction, metadata, redirects, and an optional prompt processed by a cheap secondary model.",
    schema,
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
