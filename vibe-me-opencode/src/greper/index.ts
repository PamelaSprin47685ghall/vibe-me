import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { GREPER_SYSTEM_PROMPT } from 'engine/subagent';
import { extractToolContext, runSubagent } from '../utils/session';

export { GREPER_SYSTEM_PROMPT };

export function createGreperTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description:
      "Receive an array of natural-language intents for code search and delegate each to the search agent. Each intent in the array runs independently in parallel. Pass as many intents as you can at once — they will be executed concurrently. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.",

    args: {
      intents: tool.schema
        .array(tool.schema.string())
        .min(1)
        .describe(
          'Array of independent search intents, each run in parallel via its own greper subagent session. Include all relevant background, design rationale, and specific requirements.',
        ),
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

      const results = await Promise.all(
        args.intents.map((intent) =>
          runSubagent(client, {
            agent: 'greper',
            title: 'Greper',
            parts: [{ type: 'text', text: intent }],
            directory,
            sessionID,
            abortSignal,
          }),
        ),
      );

      return results.join('\n---\n');
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
