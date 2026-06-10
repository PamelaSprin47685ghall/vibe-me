import type { PluginInput } from '@opencode-ai/plugin';
import { isAgentRole } from 'engine/agent-policy';
import { createCapsMessagesInjector } from '../caps/index.js';
import { createToolOutputDeduper } from '../dedup/index.js';
import { createSyntaxCheckHook } from '../tree-sitter/index.js';
import { lookupChildAgent } from '../utils/child-agent.js';
import { getAgentToolDefaults, mergeTools } from '../agent-tools.js';
import type { createNudgeCoordinatorHook } from '../nudge/index.js';
import type { createLoopCommandManager } from '../loop/index.js';

type NudgeCoordinator = ReturnType<typeof createNudgeCoordinatorHook>;
type LoopCommandManager = ReturnType<typeof createLoopCommandManager>;

export function createHooks(
  ctx: PluginInput,
  nudgeHook: NudgeCoordinator,
  loopCommandManager: LoopCommandManager,
) {
  const capsInjector = createCapsMessagesInjector(ctx.directory, [
    'browser',
    'greper',
    'runner',
    'title',
  ]);
  const syntaxCheckHook = createSyntaxCheckHook(ctx);
  const toolOutputDeduper = createToolOutputDeduper();

  return {
    'chat.message': async (
      input: { agent?: string; sessionID: string },
      // biome-ignore lint/suspicious/noExplicitAny: matches SDK Hooks type
      output: { parts: unknown[]; message: any },
    ) => {
      const agent = input.agent ?? lookupChildAgent(input.sessionID) ?? 'orchestrator';
      nudgeHook.handleChatMessage({ sessionID: input.sessionID, agent, parts: output.parts });
      const defaults = isAgentRole(agent) ? getAgentToolDefaults(agent) : null;
      if (!defaults) return;
      output.message.tools = mergeTools(
        output.message.tools as Record<string, unknown> | undefined,
        defaults
      );
    },

    'experimental.chat.messages.transform': async (
      _input: Record<string, never>,
      output: { messages: unknown[] },
    ): Promise<void> => {
      await capsInjector.handleMessagesTransform(output);
      await toolOutputDeduper.handleMessagesTransform(output);
      const typedOutput = output as {
        messages: Array<{
          info: { role: string; agent?: string; sessionID?: string };
          parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
        }>;
      };
      await nudgeHook.handleMessagesTransform({ messages: typedOutput.messages });
    },

    'tool.execute.before': async (
      input: { tool: string; sessionID: string; callID: string },
      // biome-ignore lint/suspicious/noExplicitAny: matches SDK Hooks type
      output: { args: any },
    ): Promise<void> => {
      if (
        (input.tool === 'editor' || input.tool === 'greper') &&
        Array.isArray(output.args?.intents)
      ) {
        output.args._ui = (output.args.intents as string[]).join('; ');
      }
    },

    'tool.execute.after': async (
      input: { tool: string; sessionID?: string; callID: string },
      output: { output?: unknown; title?: string; metadata?: Record<string, unknown> },
    ): Promise<void> => {
      await syntaxCheckHook['tool.execute.after'](input, output);
      await nudgeHook.handleToolExecuteAfter(input, output);
    },

    'command.execute.before': async (
      input: { command: string; sessionID: string; arguments: string },
      output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      await loopCommandManager.handleCommandExecuteBefore(input, output);
      await nudgeHook.handleCommandExecuteBefore(input, output);
    },

    event: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      await nudgeHook.handleEvent(input);
    },
  };
}