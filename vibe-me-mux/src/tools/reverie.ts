import fs from "node:fs/promises";
import path from "node:path";
import type { JsonSchema, PluginToolArgs, ReverieToolArgs, ToolDefinition } from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { REVERIE_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";
import { delegateToSubAgent } from "./delegate.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description: "A natural-language intent or question to contemplate...",
    },
    files: {
      type: "array",
      items: {
        type: "string",
        description: "File path to provide as context...",
      },
      description: "File paths to provide as context...",
    },
  },
  required: ["intent", "files"],
  additionalProperties: false,
};

export function createReverieTool(deps: HostDependencies): ToolDefinition {

  return {
    name: "reverie",
    description:
      "Receive a natural-language intent or question for deep reasoning and delegate to the reverie agent. IMPORTANT: Do NOT assume the reverie agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent and files. Failure to do so will cause severe confusion.",
    parameters,
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
      return delegateToSubAgent(config, deps, "explore", prompt, "Reverie", {
        experiments: {
          toolPolicy: {
            disabledTools: [...REVERIE_SUB_AGENT_DISABLED_TOOLS],
          },
        },
      });
    },
  };
}
