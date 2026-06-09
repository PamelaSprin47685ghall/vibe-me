import { resolve } from 'node:path';
import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { readReverieFiles } from 'engine/reverie-files';
import { REVERIE_SYSTEM_PROMPT } from 'engine/subagent';
import { extractToolContext, runSubagent } from '../utils/session';

export { REVERIE_SYSTEM_PROMPT };

export function createReverieTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description:
      'Receive a natural-language intent or question for deep reasoning and delegate to the reverie agent. IMPORTANT: Do NOT assume the reverie agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent and files. Failure to do so will cause severe confusion.',

    args: {
      intent: tool.schema
        .string()
        .describe(
          'A natural-language intent or question to contemplate. Must include all relevant background, design rationale, and specific requirements. Do not assume the agent knows anything about the project context.',
        ),
      files: tool.schema
        .array(tool.schema.string())
        .describe(
          'File paths to provide as context. Include any design docs, relevant code, or background material the agent needs to understand the question.',
        ),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );

      const parts: Array<{ type: 'text'; text: string }> = [];

      const readResults = await readReverieFiles(directory, args.files);
      const readResultMap = new Map(
        readResults.map((r) => [r.filePath, r.content]),
      );

      for (const file of args.files) {
        const absolute = resolve(directory, file);
        const content = readResultMap.get(absolute);
        parts.push({
          type: 'text',
          text:
            content != null
              ? `=== ${file} ===\n\n${content}`
              : `=== ${file} ===\n\n(skipped)`,
        });
      }

      if (parts.length > 0) {
        parts.push({ type: 'text', text: '' });
      }
      parts.push({ type: 'text', text: `Question:\n${args.intent}` });

      return runSubagent(client, {
        agent: 'reverie',
        title: 'Reverie',
        parts,
        directory,
        sessionID,
        abortSignal,
      });
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
