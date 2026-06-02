import { tool } from "ai";
import { z } from "zod";
import { validateFetchUrl, ollamaPost } from "engine/ollama";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";

const WebfetchToolInputSchema = z.object({
  url: z.string().describe("The URL to fetch"),
  extract_main: z.boolean().nullish().describe("Extract main content from the page, removing navigation, ads, etc. (default: true)"),
  prefer_llms_txt: z.enum(["auto", "always", "never"]).nullish().describe("Probe for llms.txt files before fetching full page (default: auto)"),
  prompt: z.string().nullish().describe("Optional extraction task to run on the fetched content using a cheap secondary model"),
  timeout: z.number().nullish().describe("Timeout in seconds (max: 120)"),
});

export const createWebfetchTool: ToolFactory = (_config: PluginToolConfiguration) => {
  return tool({
    description:
      "Fetch a URL with better extraction for static/docs pages. Supports llms.txt probing, content-focused HTML extraction, metadata, redirects, and an optional prompt processed by a cheap secondary model.",
    inputSchema: WebfetchToolInputSchema,
    execute: async (args) => {
      try {
        await validateFetchUrl(String(args.url));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JSON.stringify({ success: false, error: message });
      }

      const fetchBody: Record<string, unknown> = { url: args.url };
      if (args.extract_main != null) fetchBody.extract_main = args.extract_main;
      if (args.prefer_llms_txt != null) fetchBody.prefer_llms_txt = args.prefer_llms_txt;
      if (args.prompt != null) fetchBody.prompt = args.prompt;
      if (args.timeout != null) fetchBody.timeout = args.timeout;

      try {
        const data = await ollamaPost("web_fetch", fetchBody);
        return JSON.stringify({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JSON.stringify({ success: false, error: `Web fetch failed: ${message}` });
      }
    },
  });
};
