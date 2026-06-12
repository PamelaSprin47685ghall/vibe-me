import fs from "node:fs/promises";
import path from "node:path";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { checkSyntax, formatSyntaxDiagnostics } from "engine/tree-sitter";


const parameters: JsonSchema = {
  type: "object",
  properties: {
    file_path: {
      type: "string",
      description: "The absolute or relative path of the file to write",
    },
    content: {
      type: "string",
      description: "The content to write to the file",
    },
  },
  required: ["file_path", "content"],
  additionalProperties: false,
};

export function createWriteTool(_deps: HostDependencies): ToolDefinition {
  return {
    name: "write",
    description:
      "Write content to a file. Resolves relative paths against the current working directory, creates parent directories if they don't exist, and runs syntax checking on the written content.",
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const file_path = requireString(args, 'file_path');
      const content = requireString(args, 'content');
      const resolved = path.resolve(config.cwd, file_path);


      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");

      const result = await checkSyntax(content, resolved);
      const diagnostics = formatSyntaxDiagnostics(resolved, result);

      let msg = `Successfully wrote to ${resolved}`;
      if (diagnostics) {
        msg += `\n\n${diagnostics}`;
      }
      return msg;
    },
  };
}
