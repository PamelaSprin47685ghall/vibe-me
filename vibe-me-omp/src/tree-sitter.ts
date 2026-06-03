import fs from 'node:fs/promises';
import path from 'node:path';
import { checkSyntax, isFileEditTool, extractFilePath, appendSyntaxDiagnosticsToOutput } from 'engine/tree-sitter';

export { checkSyntax, isFileEditTool, extractFilePath };

export function supportsSyntaxDiagnosticsTool(toolName) {
  return isFileEditTool(toolName);
}

export async function appendSyntaxDiagnostics(cwd, event) {
  if (!isFileEditTool(event?.tool)) return;

  const filePath = extractFilePath(event?.args);
  if (!filePath) return;

  const fullPath = path.resolve(cwd, filePath);
  let content;
  try {
    content = await fs.readFile(fullPath, 'utf-8');
  } catch {
    return;
  }

  const checkResult = await checkSyntax(content, filePath);
  const currentOutput = event.result;
  if (typeof currentOutput !== 'string') return;

  event.result = appendSyntaxDiagnosticsToOutput(currentOutput, filePath, content, checkResult);
}
