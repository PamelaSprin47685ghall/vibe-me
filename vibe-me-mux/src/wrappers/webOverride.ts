import type { ToolWrapperRegistration } from "../types/tool";
import { createWebsearchTool } from "../tools/websearch";
import { createWebfetchTool } from "../tools/webfetch";

export const webSearchOverride: ToolWrapperRegistration = {
  targetTool: "web_search",
  wrapper: (_tool, config) => createWebsearchTool(config),
};

export const webFetchOverride: ToolWrapperRegistration = {
  targetTool: "web_fetch",
  wrapper: (_tool, config) => createWebfetchTool(config),
};