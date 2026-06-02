import type { SchemaFactory, ToolDefinition, PluginToolArgs, GreperToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { delegateToSubAgent } from "./delegate";

export function createGreperTool<S>(
  deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    intent: f.string(
      "Natural-language description of the code to search for",
    ),
  });

  return {
    name: "greper",
    description:
      "Receive a natural-language intent for code search and delegate to the search agent. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const { intent } = args as GreperToolArgs;
      return delegateToSubAgent(config, deps, "explore", intent, "Greper");
    },
  };
}
