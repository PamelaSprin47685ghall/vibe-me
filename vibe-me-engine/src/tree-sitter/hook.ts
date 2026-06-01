import { checkSyntax } from './checker.js';

const FILE_EDIT_TOOLS = new Set(['edit', 'write', 'Write', 'ast_edit', 'ast_grep_replace', 'file_edit_replace_string', 'file_edit_insert']);
const SYNTAX_CHECK_MARKER = '[syntax-check]';

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

export function formatSyntaxDiagnostics(filePath: string, result: { ok: true; lang: string; errors: { line: number; column: number; endLine: number; endColumn: number; severity: string; message: string }[] }): string {
  const lines = [
    '',
    SYNTAX_CHECK_MARKER,
    `${result.errors.length} syntax issue(s) in ${filePath} (${result.lang}):`,
    ...result.errors.map((e) => `  L${e.line}:${e.column}-${e.endLine}:${e.endColumn} [${e.severity}] ${e.message}`),
  ];
  return lines.join('\n');
}

export async function appendSyntaxDiagnostics(filePath: string, content: string): Promise<string | null> {
  const result = await checkSyntax(content, filePath);
  if (!result.ok || result.errors.length === 0) return null;
  return formatSyntaxDiagnostics(filePath, result);
}
