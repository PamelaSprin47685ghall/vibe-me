import { checkSyntax } from './checker.js';
import type { SyntaxCheckResult } from '../util/types.js';

const FILE_EDIT_TOOLS = new Set(['edit', 'write', 'Write', 'ast_edit', 'ast_grep_replace', 'file_edit_replace_string', 'file_edit_insert', 'apply_patch']);
export const SYNTAX_CHECK_MARKER = '[syntax-check]';

export function isFileEditTool(tool: string): boolean {
  return FILE_EDIT_TOOLS.has(tool);
}

export function extractFilePath(args: Record<string, unknown> | undefined | null): string | null {
  return extractFilePaths(args)[0] ?? null;
}

export function extractFilePaths(args: Record<string, unknown> | undefined | null): string[] {
  if (!args || typeof args !== 'object') return [];
  const candidate = (args.path ?? args.file_path ?? args.filePath) as string | undefined;
  if (typeof candidate === 'string' && candidate.length > 0) return [candidate];

  const patchText = args.patchText;
  if (typeof patchText !== 'string') return [];

  return Array.from(
    new Set(
      patchText
        .split('\n')
        .flatMap((line) => line.match(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/)?.[1] ?? [])
    )
  );
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
