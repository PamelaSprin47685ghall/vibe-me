import { TOOL_COPY } from "engine/tool-copy";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString, optionalString, optionalBoolean, optionalNumber } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { ollamaPost, formatFetchResponse, validateFetchUrl } from "engine/ollama";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: TOOL_COPY.webfetch.params.url,
    },
    extract_main: {
      type: "boolean",
      description: TOOL_COPY.webfetch.params.extract_main,
    },
    prefer_llms_txt: {
      type: "string",
      enum: ["auto", "always", "never"],
      description: TOOL_COPY.webfetch.params.prefer_llms_txt,
    },
    prompt: {
      type: "string",
      description: TOOL_COPY.webfetch.params.prompt,
    },
    timeout: {
      type: "number",
      description: TOOL_COPY.webfetch.params.timeout,
    },
  },
  required: ["url"],
  additionalProperties: false,
};

export function createWebfetchTool(_deps: HostDependencies): ToolDefinition {

  return {
    name: "webfetch",
    description: TOOL_COPY.webfetch.description,
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const url = requireString(args, 'url');
      const extract_main = optionalBoolean(args, 'extract_main');
      const prefer_llms_txt = optionalString(args, 'prefer_llms_txt');
      const prompt = optionalString(args, 'prompt');
      const timeout = optionalNumber(args, 'timeout');
      const urlError = await validateFetchUrl(url);
      if (urlError) return JSON.stringify({ success: false, error: urlError });

      const fetchBody: Record<string, unknown> = { url };
      if (extract_main != null) fetchBody.extract_main = extract_main;
      if (prefer_llms_txt != null)
        fetchBody.prefer_llms_txt = prefer_llms_txt;
      if (prompt != null) fetchBody.prompt = prompt;
      if (timeout != null) fetchBody.timeout = timeout;

      try {
        const data = await ollamaPost("web_fetch", fetchBody, config.abortSignal);
        return formatFetchResponse(data);
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
