import fs from "node:fs/promises";
import path from "node:path";
import { checkSyntax, extractFilePath, isFileEditTool } from "engine/tree-sitter";
import type { PluginToolConfiguration } from "../types/tool";
import type { LoggerLike } from "../types/deps";
import type { ToolLike, ToolWrapper, PluginToolArgs } from "../types/contract";

const SYNTAX_CHECK_MARKER = "[syntax-check]";

interface SyntaxCheckOk {
  ok: true;
  lang: string;
  errors: Array<{ line: number; column: number; message: string }>;
}

function formatSyntaxErrors(result: SyntaxCheckOk, filePath: string): string {
  if (result.errors.length === 0) {
    return `${SYNTAX_CHECK_MARKER} ${filePath}: ok (${result.lang})`;
  }

  const lines = result.errors.map(
    (e) => `  Ln ${e.line + 1}, Col ${e.column}: ${e.message}`,
  );
  return `${SYNTAX_CHECK_MARKER} ${filePath}: ${result.errors.length} error(s) in ${result.lang}\n${lines.join("\n")}`;
}

function wrapFileEditTool(
  baseTool: ToolLike,
  config: PluginToolConfiguration,
  log: LoggerLike,
): ToolLike {
  const originalExecute = baseTool.execute;
  if (typeof originalExecute !== "function") return baseTool;

  const clone: ToolLike = Object.create(
    Object.getPrototypeOf(baseTool) as object | null,
    Object.getOwnPropertyDescriptors(baseTool),
  );

  clone.execute = ((
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
  }) as ToolLike["execute"];

  return clone;
}

function appendSyntaxCheck(
  result: unknown,
  args: PluginToolArgs,
  baseTool: ToolLike,
  config: PluginToolConfiguration,
  log: LoggerLike,
): unknown {
  if (typeof result !== "string" || result.includes(SYNTAX_CHECK_MARKER)) {
    return result;
  }

  const toolName = baseTool.name ?? "";
  if (!isFileEditTool(toolName)) return result;

  const filePath = extractFilePath(
    args as Record<string, unknown> | null | undefined,
  );
  if (!filePath) return result;

  return (async () => {
    try {
      const resolvedPath = path.resolve(config.cwd, filePath);
      const content = await fs.readFile(resolvedPath, "utf-8");
      const checkResult = await checkSyntax(content, filePath);

      if (checkResult.ok) {
        return result + "\n\n" + formatSyntaxErrors(checkResult, filePath);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.debug("[syntaxCheck] wrapper failed", { reason });
    }
    return result;
  })();
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
