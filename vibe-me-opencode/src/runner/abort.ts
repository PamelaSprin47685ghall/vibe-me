import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { abort } from 'engine/runner';

export function createRunnerAbortTool(): ToolDefinition {
  return tool({
    description: 'Forcefully terminate the currently running background task.',
    args: {},
    async execute(_args, context) {
      try {
        return abort(context.sessionID);
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  });
}
