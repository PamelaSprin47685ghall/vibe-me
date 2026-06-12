import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { readReverieFiles } from 'engine/reverie-files';
import { REVERIE_SYSTEM_PROMPT } from 'engine/subagent';
import { reverieRole, buildReveriePrompt } from 'engine';
import { TOOL_COPY } from 'engine/tool-copy';
import { extractToolContext } from '../utils/session';
import { createEngineAdapter } from '../utils/engine-adapter';

export { REVERIE_SYSTEM_PROMPT };

export function createReverieTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.reverie.description,

    args: {
      intent: tool.schema
        .string()
        .describe(TOOL_COPY.reverie.params.intent),
      files: tool.schema
        .array(tool.schema.string())
        .describe(TOOL_COPY.reverie.params.files),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );
      const readResults = await readReverieFiles(directory, args.files);
      const sections = args.files.map((file, i) => ({
        file,
        content: readResults[i]?.content,
      }));
      const prompt = buildReveriePrompt(sections, args.intent);
      const adapter = createEngineAdapter(client, { directory, sessionID, abortSignal });
      return adapter.promptSubagent({ role: reverieRole, prompt, title: 'Reverie' });
    },
  });
}

export function getReverieConfig() {
  return {
    agents: {
      reverie: {
        prompt: REVERIE_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        permission: {
          bash: 'deny',
          edit: 'deny',
          write: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
          read: 'deny',
        } as Record<string, unknown>,
        mcps: [],
      },
    },
  };
}
