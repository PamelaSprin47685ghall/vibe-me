import type { PluginInput } from '@opencode-ai/plugin';
import { agentRoleFromString } from 'engine/agent-policy';
import { getAgentToolDefaults, mergeTools } from '../agent-tools.js';
import { createCapsMessagesInjector } from '../caps/index.js';
import { createToolOutputDeduper } from '../dedup/index.js';
import type { createLoopCommandManager } from '../loop/index.js';
import type { createNudgeCoordinatorHook } from '../nudge/index.js';
import { createSyntaxCheckHook } from '../tree-sitter/index.js';
import { lookupChildAgent } from '../utils/child-agent.js';

type NudgeCoordinator = ReturnType<typeof createNudgeCoordinatorHook>;
type LoopCommandManager = ReturnType<typeof createLoopCommandManager>;

type CapsInjector = {
  handleMessagesTransform(output: { messages: unknown[] }): Promise<void>;
};

type ToolOutputDeduper = {
  handleMessagesTransform(output: { messages: unknown[] }): Promise<void>;
};

type SyntaxCheckHook = {
  'tool.execute.after'(
    input: { tool: string; sessionID?: string; callID: string },
    output: {
      output?: unknown;
      title?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
};

type HookFactories = {
  createCapsMessagesInjector: (
    directory: string,
    excludedAgents: string[],
  ) => CapsInjector;
  createToolOutputDeduper: () => ToolOutputDeduper;
  createSyntaxCheckHook: (ctx: PluginInput) => SyntaxCheckHook;
};

const DEFAULT_EXCLUDED_AGENTS = ['browser', 'greper', 'executor', 'title'];

type ChatMessageInput = { agent?: string; sessionID: string };
type ChatMessageOutput = {
  parts: unknown[];
  message: { tools?: Record<string, unknown> };
};

type MessagesTransformOutput = { messages: unknown[] };

type ToolExecuteBeforeInput = {
  tool: string;
  sessionID: string;
  callID: string;
};
type ToolExecuteBeforeOutput = { args: { intents?: unknown; _ui?: string } };

type ToolExecuteAfterInput = {
  tool: string;
  sessionID?: string;
  callID: string;
};
type ToolExecuteAfterOutput = {
  output?: unknown;
  title?: string;
  metadata?: Record<string, unknown>;
};

type CommandExecuteBeforeInput = {
  command: string;
  sessionID: string;
  arguments: string;
};
type CommandExecuteBeforeOutput = {
  parts: Array<{ type: string; text?: string }>;
};

type EventInput = {
  event: { type: string; properties?: Record<string, unknown> };
};

function resolveAgent(input: ChatMessageInput): string {
  return input.agent ?? lookupChildAgent(input.sessionID) ?? 'orchestrator';
}

function applyStealthBrowserRestrictions(
  tools: Record<string, boolean>,
  agent: string,
  existingTools: Record<string, unknown> | undefined,
): void {
  if (agent === 'browser') return;
  if (existingTools) {
    for (const key of Object.keys(existingTools)) {
      if (key.startsWith('stealth-browser-mcp_')) tools[key] = false;
    }
  }
  tools['stealth-browser-mcp_*'] = false;
}

function applyOrchestratorRestrictions(
  tools: Record<string, boolean>,
  agent: string,
): void {
  if (agent === 'orchestrator') tools.patch = false;
}

function createChatMessageHandler(nudgeHook: NudgeCoordinator) {
  return async (
    input: ChatMessageInput,
    output: ChatMessageOutput,
  ): Promise<void> => {
    const agent = resolveAgent(input);
    nudgeHook.handleChatMessage({
      sessionID: input.sessionID,
      agent,
      parts: output.parts,
    });
    if (agentRoleFromString(agent)._tag !== 'Ok') return;
    const defaults = getAgentToolDefaults(agent);
    const tools = mergeTools(output.message.tools, defaults);
    applyStealthBrowserRestrictions(tools, agent, output.message.tools);
    applyOrchestratorRestrictions(tools, agent);
    output.message.tools = tools;
  };
}

function createMessagesTransformHandler(
  capsInjector: CapsInjector,
  toolOutputDeduper: ToolOutputDeduper,
  nudgeHook: NudgeCoordinator,
) {
  return async (
    _input: Record<string, never>,
    output: MessagesTransformOutput,
  ): Promise<void> => {
    await capsInjector.handleMessagesTransform(output);
    await toolOutputDeduper.handleMessagesTransform(output);
    await nudgeHook.handleMessagesTransform({ messages: output.messages });
  };
}

function createToolExecuteBeforeHandler() {
  return async (
    input: ToolExecuteBeforeInput,
    output: ToolExecuteBeforeOutput,
  ): Promise<void> => {
    if (
      (input.tool === 'editor' || input.tool === 'greper') &&
      Array.isArray(output.args?.intents)
    ) {
      output.args._ui = (output.args.intents as string[]).join('; ');
    }
  };
}

function createToolExecuteAfterHandler(
  syntaxCheckHook: SyntaxCheckHook,
  nudgeHook: NudgeCoordinator,
) {
  return async (
    input: ToolExecuteAfterInput,
    output: ToolExecuteAfterOutput,
  ): Promise<void> => {
    await syntaxCheckHook['tool.execute.after'](input, output);
    await nudgeHook.handleToolExecuteAfter(input, output);
  };
}

function createCommandExecuteBeforeHandler(
  loopCommandManager: LoopCommandManager,
  nudgeHook: NudgeCoordinator,
) {
  return async (
    input: CommandExecuteBeforeInput,
    output: CommandExecuteBeforeOutput,
  ): Promise<void> => {
    await loopCommandManager.handleCommandExecuteBefore(input, output);
    await nudgeHook.handleCommandExecuteBefore(input, output);
  };
}

function createEventHandler(nudgeHook: NudgeCoordinator) {
  return async (input: EventInput): Promise<void> => {
    await nudgeHook.handleEvent(input);
  };
}

export function createHooks(
  ctx: PluginInput,
  nudgeHook: NudgeCoordinator,
  loopCommandManager: LoopCommandManager,
  factories: HookFactories = {
    createCapsMessagesInjector,
    createToolOutputDeduper,
    createSyntaxCheckHook,
  },
) {
  const capsInjector = factories.createCapsMessagesInjector(
    ctx.directory,
    DEFAULT_EXCLUDED_AGENTS,
  );
  const toolOutputDeduper = factories.createToolOutputDeduper();
  const syntaxCheckHook = factories.createSyntaxCheckHook(ctx);

  return {
    'chat.message': createChatMessageHandler(nudgeHook),
    'experimental.chat.messages.transform': createMessagesTransformHandler(
      capsInjector,
      toolOutputDeduper,
      nudgeHook,
    ),
    'tool.execute.before': createToolExecuteBeforeHandler(),
    'tool.execute.after': createToolExecuteAfterHandler(
      syntaxCheckHook,
      nudgeHook,
    ),
    'command.execute.before': createCommandExecuteBeforeHandler(
      loopCommandManager,
      nudgeHook,
    ),
    event: createEventHandler(nudgeHook),
  };
}
