import type { Plugin } from '@opencode-ai/plugin';
import {
  AGENT_POLICIES,
  type AgentRole,
  agentRoleFromString,
  agentRoleToString,
  applyUniversalPermissionDeny,
  getAgentTools,
  isAgentRole,
} from 'engine/agent-policy';
import { createBrowserTool, getBrowserConfig } from './browser/index.js';
import { createCapsMessagesInjector } from './caps/index.js';
import { createToolOutputDeduper } from './dedup/index.js';
import { createEditorTool, getEditorConfig } from './editor/index.js';
import { createFuzzyFindTool, createFuzzyGrepTool } from './fuzzy/index.js';
import { createGreperTool, getGreperConfig } from './greper/index.js';
import {
  createLoopCommandManager,
  createSubmitReviewResultTool,
  createSubmitReviewTool,
  getReviewerConfig,
} from './loop/index.js';
import { getMcpConfig } from './mcp/index.js';
import { createNudgeCoordinatorHook } from './nudge/index.js';
import {
  createOllamaWebFetchTool,
  createOllamaWebSearchTool,
} from './ollama-web/index.js';
import { createReverieTool, getReverieConfig } from './reverie/index.js';
import {
  createRunnerAbortTool,
  createRunnerTool,
  createRunnerWaitTool,
  getRunnerConfig,
} from './runner/index.js';
import { createSyntaxCheckHook } from './tree-sitter/index.js';
import { lookupChildAgent } from './utils/child-agent.js';
import { applyAgentConfig } from './agent-config.js';
import { getAgentToolDefaults, mergeTools } from './agent-tools.js';

const KunweiPlugin: Plugin = async (ctx) => {
  const mcps = getMcpConfig();
  const capsInjector = createCapsMessagesInjector(ctx.directory, [
    'browser',
    'greper',
    'runner',
    'title',
  ]);
  const nudgeHook = createNudgeCoordinatorHook(ctx);
  const loopCommandManager = createLoopCommandManager(ctx);
  const syntaxCheckHook = createSyntaxCheckHook(ctx);
  const toolOutputDeduper = createToolOutputDeduper();

  return {
    name: 'kunwei',
    mcp: mcps,

    tool: {
      ...nudgeHook.tool,
      editor: createEditorTool(ctx),
      greper: createGreperTool(ctx),
      reverie: createReverieTool(ctx),
      submit_review: createSubmitReviewTool(ctx),
      submit_review_result: createSubmitReviewResultTool(),
      webfetch: createOllamaWebFetchTool(),
      websearch: createOllamaWebSearchTool(),
      runner: createRunnerTool(ctx),
      browser: createBrowserTool(ctx),
      fuzzy_find: createFuzzyFindTool(),
      fuzzy_grep: createFuzzyGrepTool(),
      runner_wait: createRunnerWaitTool(),
      runner_abort: createRunnerAbortTool(),
    },

    'chat.message': async (input, output) => {
      const agent =
        input.agent ?? lookupChildAgent(input.sessionID) ?? 'orchestrator';
      nudgeHook.handleChatMessage({
        sessionID: input.sessionID,
        agent,
        parts: output.parts,
      });
      const defaults = isAgentRole(agent) ? getAgentToolDefaults(agent) : null;
      if (!defaults) return;
      output.message.tools = mergeTools(
        output.message.tools as Record<string, unknown> | undefined, 
        defaults
      );
    },

    config: async (opencodeConfig) => {
      // biome-ignore lint/suspicious/noExplicitAny: config matches internal any structure
      applyAgentConfig(opencodeConfig as any, mcps);
      // biome-ignore lint/suspicious/noExplicitAny: commandManager matches any config
      loopCommandManager.registerCommand(opencodeConfig as any);
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
          parts: Array<{
            type: string;
            text?: string;
            [key: string]: unknown;
          }>;
        }>;
      };
      await nudgeHook.handleMessagesTransform({
        messages: typedOutput.messages,
      });
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
      output: {
        output?: unknown;
        title?: string;
        metadata?: Record<string, unknown>;
      },
    ): Promise<void> => {
      await syntaxCheckHook['tool.execute.after'](input, output);
      await nudgeHook.handleToolExecuteAfter(input, output);
    },

    'command.execute.before': async (
      input: {
        command: string;
        sessionID: string;
        arguments: string;
      },
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
};

export default KunweiPlugin;
