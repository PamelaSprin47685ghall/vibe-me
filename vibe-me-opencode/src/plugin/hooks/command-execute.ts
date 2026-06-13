import type {
  CommandExecuteBeforeInput,
  CommandExecuteBeforeOutput,
  LoopCommandManager,
  NudgeCoordinator,
} from './types.js';

export async function runCommandExecuteBefore(
  loopCommandManager: LoopCommandManager,
  nudgeHook: NudgeCoordinator,
  input: CommandExecuteBeforeInput,
  output: CommandExecuteBeforeOutput,
): Promise<void> {
  await loopCommandManager.handleCommandExecuteBefore(input, output);
  await nudgeHook.handleCommandExecuteBefore(input, output);
}
