import { checkSyntax } from './checker.js';
import type { SyntaxCheckResult } from '../util/types.js';

const FILE_EDIT_TOOLS = new Set(['edit', 'write', 'Write', 'ast_edit', 'ast_grep_replace', 'file_edit_replace_string', 'file_edit_insert']);
export const SYNTAX_CHECK_MARKER = '[syntax-check]';

export function isFileEditTool(tool: string): boolean {
  return FILE_EDIT_TOOLS.has(tool);
}

export function extractFilePath(args: Record<string, unknown> | undefined | null): string | null {
  if (!args || typeof args !== 'object') return null;
  const candidate = (args.path ?? args.file_path ?? args.filePath) as string | undefined;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export function hasSyntaxCheckMarker(text: string): boolean {
  return text.includes(SYNTAX_CHECK_MARKER);
}

export function formatSyntaxDiagnostics(
  filePath: string,
  result: SyntaxCheckResult,
  options?: { includeOk?: boolean }
): string | null {
  if (result.errors.length === 0) {
    if (options?.includeOk) {
      return `${SYNTAX_CHECK_MARKER} ${filePath}: ok (${result.lang})`;
    }
    return null;
  }
  const lines = [
    SYNTAX_CHECK_MARKER,
    `${result.errors.length} syntax issue(s) in ${filePath} (${result.lang}):`,
    ...result.errors.map((e) => `  L${e.line}:${e.column}-${e.endLine}:${e.endColumn} [${e.severity}] ${e.message}`),
  ];
  return lines.join('\n');
}

export async function appendSyntaxDiagnostics(
  filePath: string,
  content: string,
  options?: { includeOk?: boolean }
): Promise<string | null> {
  const result = await checkSyntax(content, filePath);
  return formatSyntaxDiagnostics(filePath, result, options);
}

export function appendSyntaxDiagnosticsToOutput(
  currentOutput: string,
  filePath: string,
  _fileContent: string,
  checkResult: SyntaxCheckResult,
): string {
  if (hasSyntaxCheckMarker(currentOutput)) return currentOutput;
  const formatted = formatSyntaxDiagnostics(filePath, checkResult);
  return formatted ? `${currentOutput}\n\n${formatted}` : currentOutput;
}
