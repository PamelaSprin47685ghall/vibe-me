import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { BROWSER_SYSTEM_PROMPT } from 'engine/subagent';
import { browserRole } from 'engine';
import { TOOL_COPY } from 'engine/tool-copy';
import { extractToolContext } from '../utils/session.js';
import { createEngineAdapter } from '../utils/engine-adapter';

export { BROWSER_SYSTEM_PROMPT };

export function createBrowserTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.browser.description,

    args: {
      intent: tool.schema
        .string()
        .describe(TOOL_COPY.browser.params.intent),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );
      const adapter = createEngineAdapter(client, { directory, sessionID, abortSignal });
      return adapter.promptSubagent({ role: browserRole, prompt: args.intent, title: 'Browser' });
    },
  });
}

export function getBrowserConfig() {
  return {
    agents: {
      browser: {
        prompt: BROWSER_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: ['stealth-browser-mcp'],
        permission: {
          read: 'allow',
          'stealth-browser-mcp_*': 'allow',
          bash: 'deny',
          write: 'deny',
          edit: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
        } as Record<string, unknown>,
      },
    },
  };
}
