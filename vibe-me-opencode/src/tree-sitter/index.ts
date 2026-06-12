import type { PluginInput } from '@opencode-ai/plugin';
import {
  extractFilePaths,
  hasSyntaxCheckMarker,
  isFileEditTool,
  readAndCheckSyntax,
} from 'engine/tree-sitter';

interface ToolExecuteAfterInput {
  tool: string;
  args?: {
    path?: string;
    file_path?: string;
    filePath?: string;
    patchText?: string;
    [key: string]: unknown;
  };
}

interface ToolExecuteAfterOutput {
  output?: unknown;
}

export function createSyntaxCheckHook(ctx: PluginInput) {
  return {
    'tool.execute.after': async (
      input: ToolExecuteAfterInput,
      output: ToolExecuteAfterOutput,
    ): Promise<void> => {
      if (!isFileEditTool(input.tool)) return;
      const current = output.output;
      if (typeof current !== 'string') return;
      if (hasSyntaxCheckMarker(current)) return;

      const filePaths = extractFilePaths(input.args);
      if (filePaths.length === 0) return;

      const diagnostics: string[] = [];

      for (const filePath of filePaths) {
        const formatted = await readAndCheckSyntax(filePath, ctx.directory);
        if (formatted) diagnostics.push(formatted);
      }

      if (diagnostics.length > 0)
        output.output = `${current}\n\n${diagnostics.join('\n\n')}`;
    },
  };
}

export type { SyntaxCheckResult, SyntaxError } from 'engine/tree-sitter';
export { checkSyntax } from 'engine/tree-sitter';
