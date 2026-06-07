import fs from 'node:fs/promises';
import path from 'node:path';
import { checkSyntax, isFileEditTool, extractFilePath, appendSyntaxDiagnosticsToOutput } from 'engine/tree-sitter';
import type { TextPart } from './shared.js';

export { checkSyntax, isFileEditTool, extractFilePath };

type ToolResultEvent = {
  toolName?: string;
  tool?: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  content?: TextPart[];
  result?: string;
};

export function supportsSyntaxDiagnosticsTool(toolName: string) {
  return isFileEditTool(toolName);
}

export async function appendSyntaxDiagnostics(cwd: string, event: ToolResultEvent) {
  const toolName = event.toolName ?? event.tool;
  if (!toolName) return;
  if (!isFileEditTool(toolName)) return;

  const input = event.input ?? event.args;
  const filePath = extractFilePath(input);
  if (!filePath) return;

  const fullPath = path.resolve(cwd, filePath);
  let content;
  try {
    content = await fs.readFile(fullPath, 'utf-8');
  } catch {
    return;
  }

  const checkResult = await checkSyntax(content, filePath);

  // pi-coding-agent format: shared content array with {type, text} blocks
  if (Array.isArray(event.content)) {
    const textBlock = event.content.find((contentBlock: TextPart) => contentBlock.type === 'text');
    if (textBlock && typeof textBlock.text === 'string') {
      textBlock.text = appendSyntaxDiagnosticsToOutput(textBlock.text, filePath, content, checkResult);
      return;
    }
  }

  // Legacy string result fallback
  if (typeof event.result === 'string') {
    event.result = appendSyntaxDiagnosticsToOutput(event.result, filePath, content, checkResult);
  }
}
