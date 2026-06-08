import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { EDITOR_SYSTEM_PROMPT } from 'engine/subagent';
import { extractToolContext, runSubagent } from '../utils/session';

export { EDITOR_SYSTEM_PROMPT };

export function createEditorTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description:
      'Receive an array of natural-language intents for code changes and delegate each to the editor agent. Each intent in the array runs independently in parallel. Pass as many intents as you can at once — they will be executed concurrently. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.',

    args: {
      intents: tool.schema
        .array(tool.schema.string())
        .min(1)
        .describe(
          'Array of independent code-change intents, each run in parallel via its own editor subagent session. Include all relevant background, design rationale, file paths, and specific requirements.',
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
            agent: 'editor',
            title: 'Editor',
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

export function getEditorConfig() {
  return {
    agents: {
      editor: {
        prompt: EDITOR_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: [],
        permission: {
          read: 'allow',
          write: 'allow',
          edit: 'allow',
          bash: 'deny',
          glob: 'allow',
          grep: 'deny',
          fuzzy_find: 'allow',
          fuzzy_grep: 'allow',
          task: 'deny',
        } as Record<string, unknown>,
      },
    },
  };
}
