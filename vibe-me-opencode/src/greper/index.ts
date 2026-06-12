import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { GREPER_SYSTEM_PROMPT } from 'engine/subagent';
import { greperRole, delegateIntents } from 'engine';
import { TOOL_COPY } from 'engine/tool-copy';
import { extractToolContext } from '../utils/session';
import { createEngineAdapter } from '../utils/engine-adapter';

export { GREPER_SYSTEM_PROMPT };

export function createGreperTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.greper.description,

    args: {
      intents: tool.schema
        .array(tool.schema.string())
        .min(1)
        .describe(TOOL_COPY.greper.params.intents),
      _ui: tool.schema
        .string()
        .optional()
        .describe('Internal: populated by hook'),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );
      const adapter = createEngineAdapter(client, { directory, sessionID, abortSignal });
      return delegateIntents(adapter, greperRole, 'Greper', args.intents);
    },
  });
}

export function getGreperConfig() {
  return {
    agents: {
      greper: {
        prompt: GREPER_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: [],
        permission: { read: 'allow', glob: 'allow', bash: 'deny', edit: 'deny', write: 'deny', grep: 'deny', fuzzy_find: 'allow', fuzzy_grep: 'allow', task: 'deny' } as Record<string, unknown>,
      },
    },
  };
}
