import fs from "node:fs/promises";
import path from "node:path";
import { checkSyntax, extractFilePath, isFileEditTool, formatSyntaxDiagnostics } from "engine/tree-sitter";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { LoggerLike } from "../types/deps.js";
import type { ToolLike, ToolWrapper } from "../types/contract.js";

function wrapFileEditTool(
  toolName: string,
  baseTool: ToolLike,
  config: PluginToolConfiguration,
  log: LoggerLike,
): ToolLike {
  const originalExecute = baseTool.execute;
  if (typeof originalExecute !== "function") return baseTool;

  return {
    ...baseTool,
    execute: ((
      args: Record<string, unknown>,
      options?: { readonly abortSignal?: AbortSignal },
    ) => {
      const result = originalExecute.call(baseTool, args, options);

      if (result instanceof Promise) {
        return result.then((resolved: unknown) =>
          appendSyntaxCheck(resolved, toolName, args, config, log),
        );
      }
      return appendSyntaxCheck(result, toolName, args, config, log);
    }) as ToolLike["execute"],
  };
}

async function appendSyntaxCheck(
  result: unknown,
  toolName: string,
  args: Record<string, unknown>,
  config: PluginToolConfiguration,
  log: LoggerLike,
): Promise<unknown> {
  if (!isFileEditTool(toolName)) return result;

  const filePath = extractFilePath(
    args as Record<string, unknown> | null | undefined,
  );
  if (!filePath) return result;

  try {
    const resolvedPath = path.resolve(config.cwd, filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");
    const checkResult = await checkSyntax(content, filePath);
    const formatted = formatSyntaxDiagnostics(filePath, checkResult);
    if (!formatted) return result;

    if (typeof result === "string") {
      return `${result}\n\n${formatted}`;
    }

    if (
      typeof result === "object" && result !== null &&
      "success" in result && (result as { success: unknown }).success === true
    ) {
      return { ...result, syntax_diagnostics: formatted };
    }
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
      wrapper: (tool, config) => wrapFileEditTool("file_edit_replace_string", tool, config, log),
    },
    {
      targetTool: "file_edit_insert",
      wrapper: (tool, config) => wrapFileEditTool("file_edit_insert", tool, config, log),
    },
  ];
}
