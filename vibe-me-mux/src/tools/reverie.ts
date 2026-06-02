import fs from "node:fs/promises";
import path from "node:path";
import type { SchemaFactory, ToolDefinition, PluginToolArgs, ReverieToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { delegateToSubAgent } from "./delegate";

export function createReverieTool<S>(
  deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    intent: f.string(
      "A natural-language intent or question to contemplate...",
    ),
    files: f.array(
      f.string("File path to provide as context..."),
      "File paths to provide as context...",
    ),
  });

  return {
    name: "reverie",
    description:
      "Receive a natural-language intent or question for deep reasoning and delegate to the reverie agent. IMPORTANT: Do NOT assume the reverie agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent and files. Failure to do so will cause severe confusion.",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const { intent, files } = args as ReverieToolArgs;
      const fileSections = await Promise.all(
        files.map(async (file) => {
          const resolvedPath = path.resolve(config.cwd, file);
          try {
            const content = await fs.readFile(resolvedPath, "utf-8");
            return `=== ${file} ===\n\n${content}`;
          } catch {
            return `=== ${file} ===\n\n(unable to read)`;
          }
        }),
      );
      const prompt = `${fileSections.join("\n")}\nQuestion:\n${intent}`;
      return delegateToSubAgent(config, deps, "explore", prompt, "Reverie");
    },
  };
}
