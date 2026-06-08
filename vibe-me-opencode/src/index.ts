import type { Plugin } from '@opencode-ai/plugin';
import { createBrowserTool, getBrowserConfig } from './browser/index.js';
import { createCapsMessagesInjector } from './caps/index.js';
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
import { createToolOutputDeduper } from './dedup/index.js';
import { lookupChildAgent } from './utils/child-agent';
import {
  AGENT_POLICIES,
  getAgentPolicy,
  applyUniversalPermissionDeny,
  isAgentRole,
  type AgentRole,
} from 'engine/agent-policy';

type ToolDefaults = Record<string, boolean>;
type AgentName = AgentRole;

function mergeTools(
  current: Record<string, unknown> | undefined,
  defaults: ToolDefaults,
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...defaults };
  for (const [key, value] of Object.entries(current ?? {})) {
    if (typeof value === 'boolean') merged[key] = value;
  }
  return merged;
}

function getAgentPermissionDefaults(agent: AgentRole): Record<string, string> {
  return { ...AGENT_POLICIES[agent].permissions };
}

function getAgentToolDefaults(agent: AgentRole): ToolDefaults {
  return getAgentPolicy(agent).tools;
}

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
      output.message.tools = mergeTools(output.message.tools, defaults);
    },

    config: async (opencodeConfig) => {
      const userAgent = opencodeConfig.agent ?? {};

      opencodeConfig.agent = {
        ...userAgent,
        ...getEditorConfig().agents,
        ...getRunnerConfig().agents,
        ...getReverieConfig().agents,
        ...getReviewerConfig().agents,
        ...getGreperConfig().agents,
        ...getBrowserConfig().agents,
        orchestrator: {
          ...(opencodeConfig.agent?.orchestrator as
            | Record<string, unknown>
            | undefined),
          tools: mergeTools(
            (
              opencodeConfig.agent?.orchestrator as
              | Record<string, unknown>
              | undefined
            )?.tools as Record<string, unknown> | undefined,
            getAgentToolDefaults('orchestrator'),
          ),
          permission: {
            ...getAgentPermissionDefaults('orchestrator'),
            ...((
              opencodeConfig.agent?.orchestrator as
              | Record<string, unknown>
              | undefined
            )?.permission as Record<string, unknown> | undefined),
          },
          mcps: [],
        },
      };

      const renameMap: Record<string, string> = {
        editor: 'editor',
        greper: 'greper',
        runner: 'runner',
        reverie: 'reverie',
        reviewer: 'reviewer',
        browser: 'browser',
      };
      for (const [oldName, newName] of Object.entries(renameMap)) {
        const userEntry = userAgent[oldName] as
          | Record<string, unknown>
          | undefined;
        if (!userEntry) continue;
        const agentEntry = (opencodeConfig.agent as Record<string, unknown>)[
          newName
        ] as Record<string, unknown> | undefined;
        if (agentEntry) Object.assign(agentEntry, userEntry);
      }

      if (userAgent.basher) {
        const runnerEntry = (opencodeConfig.agent as Record<string, unknown>)
          .runner as Record<string, unknown> | undefined;
        if (runnerEntry) Object.assign(runnerEntry, userAgent.basher);
        delete (opencodeConfig.agent as Record<string, unknown>).basher;
      }

      const configMcp = opencodeConfig.mcp as
        | Record<string, unknown>
        | undefined;
      if (!configMcp) {
        opencodeConfig.mcp = { ...mcps };
      } else {
        Object.assign(configMcp, mcps);
      }

      loopCommandManager.registerCommand(opencodeConfig);

      const agentConfig = opencodeConfig.agent as Record<string, unknown>;
      for (const [name, entry] of Object.entries(agentConfig)) {
        if (typeof entry !== 'object' || !entry) continue;
        const agent = entry as Record<string, unknown>;
        const perm =
          (agent.permission as Record<string, string> | undefined) ?? {};
        if (isAgentRole(name)) {
          const defaults = getAgentPermissionDefaults(name);
          for (const [key, value] of Object.entries(defaults)) {
            if (perm[key] === undefined) perm[key] = value;
          }
          applyUniversalPermissionDeny(name, perm);
        } else {
          applyUniversalPermissionDeny('runner', perm);
        }
        agent.permission = perm;

        if (isAgentRole(name)) {
          agent.tools = mergeTools(
            agent.tools as Record<string, unknown> | undefined,
            getAgentToolDefaults(name),
          );
        }
      }
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
