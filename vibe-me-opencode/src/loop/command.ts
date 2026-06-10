import type { PluginInput } from '@opencode-ai/plugin';
import { handleLoop } from './command-loop';
import { handleLoopReview } from './command-loop-review';
import { registerCommand } from './command-register';

export function createLoopCommandManager(ctx: PluginInput) {
  async function handleCommandExecuteBefore(
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string }> },
  ): Promise<void> {
    await handleLoopReview(ctx, input, output);
    await handleLoop(input, output);
  }

  return { registerCommand, handleCommandExecuteBefore };
}