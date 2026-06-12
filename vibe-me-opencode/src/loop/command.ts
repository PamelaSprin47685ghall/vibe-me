import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import { handleLoop } from './command-loop';
import { handleLoopReview } from './command-loop-review';
import { registerCommand } from './command-register';

export function createLoopCommandManager(ctx: PluginInput, reviewStore: ReviewStore) {
  async function handleCommandExecuteBefore(
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string }> },
  ): Promise<void> {
    await handleLoopReview(ctx, reviewStore, input, output);
    await handleLoop(reviewStore, input, output);
  }

  return { registerCommand, handleCommandExecuteBefore };
}