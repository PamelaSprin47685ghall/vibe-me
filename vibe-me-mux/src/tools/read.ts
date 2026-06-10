import fs from "node:fs/promises";
import path from "node:path";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";

interface ReadToolArgs {
  readonly path: string;
  readonly offset?: number;
  readonly limit?: number;
}
import type { HostDependencies } from "../types/deps.js";
import { isExcludedDir } from "engine/util";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "The absolute or relative path of the file or directory to read",
    },
    offset: {
      type: "number",
      description: "For files only: the line number to start reading from (1-indexed)",
    },
    limit: {
      type: "number",
      description: "For files only: the maximum number of lines to read",
    },
  },
  required: ["path"],
  additionalProperties: false,
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

async function listDirectoryEntries(dirPath: string): Promise<string> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const filtered = entries.filter((e) => !isExcludedDir(e.name));

  const items = await Promise.all(
    filtered.map(async (entry) => {
      let typeChar: string;
      let size: string;
      let mtime: string;

      try {
        const stat = await fs.stat(path.join(dirPath, entry.name));
        if (entry.isDirectory()) {
          typeChar = "d";
          size = "-";
        } else if (entry.isSymbolicLink()) {
          typeChar = "l";
          size = String(stat.size);
        } else {
          typeChar = "-";
          size = String(stat.size);
        }
        mtime = formatTime(stat.mtimeMs);
      } catch {
        typeChar = "?";
        size = "?";
        mtime = "?";
      }

      const nameSuffix = entry.isDirectory() ? "/" : "";

      return { typeChar, size, mtime, sortKey: entry.isDirectory() ? `0${entry.name}` : `1${entry.name}`, display: `${typeChar}  ${size}  ${mtime}  ${entry.name}${nameSuffix}` };
    }),
  );

  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return items.map((i) => i.display).join("\n");
}

async function readFileWithLineNumbers(filePath: string, offset?: number, limit?: number): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  if (content.endsWith("\n")) {
    lines.pop();
  }

  const start = offset != null && offset >= 1 ? offset : 1;
  const end = limit != null ? start + limit : lines.length + 1;
  const sliceStart = start - 1;
  const sliceEnd = Math.min(end - 1, lines.length);

  if (sliceStart >= lines.length) {
    return "";
  }

  const selected = lines.slice(sliceStart, sliceEnd);
  return selected
    .map((line, idx) => `${sliceStart + idx + 1}: ${line}`)
    .join("\n");
}

export function createReadTool(
  _deps: HostDependencies,
  hostFileReadExecute?: (args: unknown, options?: { readonly abortSignal?: AbortSignal }) => Promise<unknown>,
): ToolDefinition {
  return {
    name: "read",
    description:
      "If path is a directory, returns a formatted directory listing (equivalent to ls -la). Use this instead of running `ls` via runner.",
    parameters,
    execute: async (config, args: Record<string, unknown>) => {
      const { path: filePath, offset, limit } = args as unknown as ReadToolArgs;
      const resolved = path.resolve(config.cwd, filePath);

      let stat;
      try {
        stat = await fs.stat(resolved);
      } catch {
        return `Error: path not found: ${filePath}`;
      }

      if (stat.isDirectory()) {
        return listDirectoryEntries(resolved);
      }

      if (stat.isFile()) {
        if (hostFileReadExecute) {
          const result = (await hostFileReadExecute(
            { path: filePath, offset, limit },
            { abortSignal: config.abortSignal },
          )) as { success: boolean; content?: string; error?: string };
          if (result.success) return result.content!;
          return `Error: ${result.error}`;
        }
        return readFileWithLineNumbers(resolved, offset, limit);
      }

      return `Error: unsupported file type: ${filePath}`;
    },
  };
}