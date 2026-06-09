import type { ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { wait } from 'engine/runner';

export function createRunnerWaitTool(): ToolDefinition {
  return tool({
    description:
      'Wait for the background task to produce more output or finish.',
    args: {
      ms: tool.schema
        .number()
        .int()
        .min(100)
        .max(30000)
        .default(2000)
        .describe('Time to wait in milliseconds'),
    },
    async execute(args, context) {
      try {
        const result = await wait({
          sessionId: context.sessionID,
          ms: args.ms,
        });
        let output = result.output;
        if (result.message) {
          output = `${output}\n\n${result.message}`;
        }
        return output || '(no new output)';
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  });
}
