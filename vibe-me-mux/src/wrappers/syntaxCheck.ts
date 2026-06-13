import { extractFilePath, readAndCheckSyntax } from "engine/tree-sitter";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { LoggerLike } from "../types/deps.js";
import type { ToolWrapper } from "../types/contract.js";
import { mapResult, wrapExecute, type ToolMiddleware } from "./middleware.js";

async function appendSyntaxCheck(
  result: unknown,
  args: Record<string, unknown>,
  config: PluginToolConfiguration,
  log: LoggerLike,
): Promise<unknown> {
  const filePath = extractFilePath(args);
  if (!filePath) return result;

  try {
    const formatted = await readAndCheckSyntax(filePath, config.cwd);
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

export function createSyntaxCheckMiddleware(
  config: PluginToolConfiguration,
  log: LoggerLike,
): ToolMiddleware {
  return mapResult((result, args) =>
    appendSyntaxCheck(result, args[0] as Record<string, unknown>, config, log)
  );
}

export function createSyntaxCheckWrappers(log: LoggerLike): ToolWrapper[] {
  return [
    {
      targetTool: "file_edit_replace_string",
      wrapper: (tool, config) => wrapExecute(tool, createSyntaxCheckMiddleware(config, log)),
    },
    {
      targetTool: "file_edit_insert",
      wrapper: (tool, config) => wrapExecute(tool, createSyntaxCheckMiddleware(config, log)),
    },
  ];
}
