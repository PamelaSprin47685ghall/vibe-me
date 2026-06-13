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
      const urlResult = requireString(args, 'url');
      if (urlResult._tag === 'Err') return urlResult.error;
      const extractMainResult = optionalBoolean(args, 'extract_main');
      if (extractMainResult._tag === 'Err') return extractMainResult.error;
      const preferLlmsTxtResult = optionalString(args, 'prefer_llms_txt');
      if (preferLlmsTxtResult._tag === 'Err') return preferLlmsTxtResult.error;
      const promptResult = optionalString(args, 'prompt');
      if (promptResult._tag === 'Err') return promptResult.error;
      const timeoutResult = optionalNumber(args, 'timeout');
      if (timeoutResult._tag === 'Err') return timeoutResult.error;
      const url = urlResult.value;
      const extract_main = extractMainResult.value;
      const prefer_llms_txt = preferLlmsTxtResult.value;
      const prompt = promptResult.value;
      const timeout = timeoutResult.value;
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
