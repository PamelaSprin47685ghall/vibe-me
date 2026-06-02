import type { SchemaFactory, ToolDefinition, PluginToolArgs, BrowserToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { delegateToSubAgent } from "./delegate";

export function createBrowserTool<S>(
  deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    intent: f.string(
      "Natural-language description of the web task to perform",
    ),
  });

  return {
    name: "browser",
    description:
      "Receive a natural-language intent for a web task and delegate to the browser agent. IMPORTANT: Do NOT assume the browser agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as BrowserToolArgs;
      return delegateToSubAgent(config, deps, "desktop", intent, "Browser");
    },
  };
}
