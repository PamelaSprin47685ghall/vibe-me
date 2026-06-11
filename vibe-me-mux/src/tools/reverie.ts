import path from "node:path";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface ReverieToolArgs {
  readonly intent: string;
  readonly files: readonly string[];
}
import type { HostDependencies } from "../types/deps.js";
import { REVERIE_TOOLS } from "engine/agent-policy";
import { delegateToSubAgent } from "./delegate.js";
import { readReverieFiles } from "engine/reverie-files";

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
    execute: async (config, args: Record<string, unknown>) => {
      const { intent, files } = args as unknown as ReverieToolArgs;
      const readResults = await readReverieFiles(config.cwd, files);
      const readResultMap = new Map(readResults.map((r) => [r.filePath, r.content]));
      const fileSections = files.map((file) => {
        const absolute = path.resolve(config.cwd, file);
        const content = readResultMap.get(absolute);
        return `=== ${file} ===\n\n${content ?? "(skipped)"}`;
      });
      const prompt = `${fileSections.join("\n")}\nQuestion:\n${intent}`;
      return delegateToSubAgent(config, deps, "explore", prompt, "Reverie", {
        aiSettingsAgentId: "exec",
        experiments: {
          subagentRole: "reverie",
          toolPolicy: {
            disabledTools: [...REVERIE_TOOLS.entries()].filter(([, p]) => p._tag === 'Deny').map(([n]) => n),
          },
        },
      });
    },
  };
}
