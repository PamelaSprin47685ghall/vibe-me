import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BROWSER_SYSTEM_PROMPT,
  EDITOR_SYSTEM_PROMPT,
  GREPER_SYSTEM_PROMPT,
  REVERIE_SYSTEM_PROMPT,
} from 'engine/subagent';
import type { PiLike, PluginContext, SharedHelpers, ToolResult } from './shared.js';

export const SUBAGENT_TOOL_NAMES = ['editor', 'greper', 'reverie', 'browse'];

export function registerSubagentTools(pi: PiLike, helpers: SharedHelpers) {
  const { asErrorResult, runSubagent } = helpers;

  pi.registerTool({
    name: 'editor',
    label: 'Editor',
    description: 'Delegate code changes to a focused editing subagent.',
    parameters: pi.typebox.Type.Object({
      intent: pi.typebox.Type.String({ description: 'Describe the desired code changes with full context.' }),
    }),
    async execute(_toolCallId: string, params: { intent: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      try {
        return {
          content: [{
            type: 'text',
            text: await runSubagent(pi, ctx, {
              toolNames: ['read', 'edit', 'write', 'find', 'fuzzy_find', 'fuzzy_grep', 'lsp'],
              prompt: `${EDITOR_SYSTEM_PROMPT}\n\n${params.intent}`,
              signal,
            }),
          }],
        };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'greper',
    label: 'Greper',
    description: 'Delegate codebase exploration to a focused search subagent.',
    parameters: pi.typebox.Type.Object({
      intent: pi.typebox.Type.String({ description: 'Describe what code or files to find with full context.' }),
    }),
    async execute(_toolCallId: string, params: { intent: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      try {
        return {
          content: [{
            type: 'text',
            text: await runSubagent(pi, ctx, {
              toolNames: ['read', 'find', 'fuzzy_find', 'fuzzy_grep'],
              prompt: `${GREPER_SYSTEM_PROMPT}\n\n${params.intent}`,
              signal,
            }),
          }],
        };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'reverie',
    label: 'Reverie',
    description: 'Delegate deep reasoning with explicit file context.',
    parameters: pi.typebox.Type.Object({
      intent: pi.typebox.Type.String({ description: 'Question or reasoning task.' }),
      files: pi.typebox.Type.Array(pi.typebox.Type.String({ description: 'File path to include as context.' })),
    }),
    async execute(_toolCallId: string, params: { intent: string; files: string[] }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      try {
        const parts = await Promise.all((params.files || []).map(async (file): Promise<string> => {
          const fullPath = path.resolve(ctx.cwd, file);
          try {
            return `=== ${file} ===\n\n${await fs.readFile(fullPath, 'utf-8')}`;
          } catch {
            return `=== ${file} ===\n\n(unable to read)`;
          }
        }));
        parts.push(`Question:\n${params.intent}`);
        return {
          content: [{
            type: 'text',
            text: await runSubagent(pi, ctx, {
              toolNames: [],
              prompt: `${REVERIE_SYSTEM_PROMPT}\n\n${parts.join('\n\n')}`,
              signal,
            }),
          }],
        };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'browse',
    label: 'Browse',
    description: 'Delegate browser tasks to a focused subagent using only the built-in browser tool.',
    parameters: pi.typebox.Type.Object({
      intent: pi.typebox.Type.String({ description: 'Describe the web task with full context.' }),
    }),
    async execute(_toolCallId: string, params: { intent: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      try {
        if (typeof pi.getAllTools !== 'function' || !pi.getAllTools().includes('browser')) {
          return { content: [{ type: 'text', text: 'Built-in browser tool is unavailable in this session.' }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: await runSubagent(pi, ctx, {
              toolNames: ['browser'],
              prompt: `${BROWSER_SYSTEM_PROMPT}\n\n${params.intent}`,
              signal,
            }),
          }],
        };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });
}
