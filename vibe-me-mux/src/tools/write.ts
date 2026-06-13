import fs from "node:fs/promises";
import path from "node:path";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireString } from "./args.js";
import type { HostDependencies } from "../types/deps.js";
import { appendSyntaxDiagnostics } from "engine/tree-sitter";


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
      const filePathResult = requireString(args, 'file_path');
      if (filePathResult._tag === 'Err') return filePathResult.error;
      const contentResult = requireString(args, 'content');
      if (contentResult._tag === 'Err') return contentResult.error;
      const file_path = filePathResult.value;
      const content = contentResult.value;
      const resolved = path.resolve(config.cwd, file_path);


      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");

      const diagnostics = await appendSyntaxDiagnostics(resolved, content);

      let msg = `Successfully wrote to ${resolved}`;
      if (diagnostics) {
        msg += `\n\n${diagnostics}`;
      }
      return msg;
    },
  };
}
