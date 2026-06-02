import fs from "node:fs/promises";
import path from "node:path";
import type { Tool } from "ai";
import { checkSyntax, extractFilePath, isFileEditTool } from "engine/tree-sitter";
import type { PluginToolConfiguration, ToolWrapperRegistration } from "../types/tool";
import type { LoggerLike } from "../types/deps";

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

function wrapFileEditTool(baseTool: Tool, config: PluginToolConfiguration, log: LoggerLike): Tool {
  const baseToolRecord = baseTool as unknown as Record<string, unknown>;
  const originalExecute = baseToolRecord.execute;

  if (typeof originalExecute !== "function") return baseTool;

  const execFn = originalExecute as (
    args: unknown,
    options: unknown,
  ) => unknown;

  const clone = Object.create(
    Object.getPrototypeOf(baseTool) as object | null,
    Object.getOwnPropertyDescriptors(baseTool),
  ) as Record<string, unknown>;

  clone.execute = async (args: unknown, options: unknown) => {
    const result = await execFn.call(baseTool, args, options);

    if (typeof result !== "string" || result.includes(SYNTAX_CHECK_MARKER)) {
      return result;
    }

    const toolName = String((baseTool as { name?: string }).name ?? "");
    if (!isFileEditTool(toolName)) return result;

    const filePath = extractFilePath(args as Record<string, unknown> | null | undefined);
    if (!filePath) return result;

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
  };

  return clone as Tool;
}

export function createSyntaxCheckWrappers(log: LoggerLike): ToolWrapperRegistration[] {
  return [
    { targetTool: "file_edit_replace_string", wrapper: (tool, config) => wrapFileEditTool(tool, config, log) },
    { targetTool: "file_edit_insert", wrapper: (tool, config) => wrapFileEditTool(tool, config, log) },
  ];
}
