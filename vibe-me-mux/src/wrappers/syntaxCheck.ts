import fs from "node:fs/promises";
import path from "node:path";
import { checkSyntax, extractFilePath, isFileEditTool, appendSyntaxDiagnosticsToOutput } from "engine/tree-sitter";
import type { PluginToolConfiguration } from "../types/tool";
import type { LoggerLike } from "../types/deps";
import type { ToolLike, ToolWrapper, PluginToolArgs } from "../types/contract";

function wrapFileEditTool(
  baseTool: ToolLike,
  config: PluginToolConfiguration,
  log: LoggerLike,
): ToolLike {
  const originalExecute = baseTool.execute;
  if (typeof originalExecute !== "function") return baseTool;

  return {
    ...baseTool,
    execute: ((
      args: PluginToolArgs,
      options?: { readonly abortSignal?: AbortSignal },
    ) => {
      const result = originalExecute.call(baseTool, args, options);

      if (result instanceof Promise) {
        return result.then((resolved: unknown) =>
          appendSyntaxCheck(resolved, args, baseTool, config, log),
        );
      }
      return appendSyntaxCheck(result, args, baseTool, config, log);
    }) as ToolLike["execute"],
  };
}

async function appendSyntaxCheck(
  result: unknown,
  args: PluginToolArgs,
  baseTool: ToolLike,
  config: PluginToolConfiguration,
  log: LoggerLike,
): Promise<unknown> {
  if (typeof result !== "string") return result;

  const toolName = baseTool.name ?? "";
  if (!isFileEditTool(toolName)) return result;

  const filePath = extractFilePath(
    args as Record<string, unknown> | null | undefined,
  );
  if (!filePath) return result;

  try {
    const resolvedPath = path.resolve(config.cwd, filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");
    const checkResult = await checkSyntax(content, filePath);
    return appendSyntaxDiagnosticsToOutput(result, filePath, content, checkResult);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.debug("[syntaxCheck] wrapper failed", { reason });
  }
  return result;
}

export function createSyntaxCheckWrappers(log: LoggerLike): ToolWrapper[] {
  return [
    {
      targetTool: "file_edit_replace_string",
      wrapper: (tool, config) => wrapFileEditTool(tool, config, log),
    },
    {
      targetTool: "file_edit_insert",
      wrapper: (tool, config) => wrapFileEditTool(tool, config, log),
    },
  ];
}
