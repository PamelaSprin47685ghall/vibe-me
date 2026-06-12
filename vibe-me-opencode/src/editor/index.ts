import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { delegateIntents, editorRole } from 'engine';
import { EDITOR_SYSTEM_PROMPT } from 'engine/subagent';
import { TOOL_COPY } from 'engine/tool-copy';
import { createEngineAdapter } from '../utils/engine-adapter';
import { extractToolContext } from '../utils/session';

export { EDITOR_SYSTEM_PROMPT };

export function createEditorTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.editor.description,

    args: {
      intents: tool.schema
        .array(tool.schema.string())
        .min(1)
        .describe(TOOL_COPY.editor.params.intents),
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
      const adapter = createEngineAdapter(client, {
        directory,
        sessionID,
        abortSignal,
      });
      return delegateIntents(adapter, editorRole, 'Editor', args.intents);
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
