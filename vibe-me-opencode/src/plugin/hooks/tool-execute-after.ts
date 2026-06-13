import type {
  NudgeCoordinator,
  SyntaxCheckHook,
  ToolExecuteAfterInput,
  ToolExecuteAfterOutput,
} from './types.js';

export async function runToolExecuteAfter(
  syntaxCheckHook: SyntaxCheckHook,
  nudgeHook: NudgeCoordinator,
  input: ToolExecuteAfterInput,
  output: ToolExecuteAfterOutput,
): Promise<void> {
  await syntaxCheckHook['tool.execute.after'](input, output);
  await nudgeHook.handleToolExecuteAfter(input, output);
}
