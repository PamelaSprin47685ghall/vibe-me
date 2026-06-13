import type { PluginInput } from '@opencode-ai/plugin';
import { createCapsMessagesInjector } from '../caps/index.js';
import { createToolOutputDeduper } from '../dedup/index.js';
import { createSyntaxCheckHook } from '../tree-sitter/index.js';
import { runCommandExecuteBefore } from './hooks/command-execute.js';
import { createEventHandler } from './hooks/event.js';
import { runMessagesTransform } from './hooks/messages-transform.js';
import { resolveAgent, resolveChatTools } from './hooks/resolve-agent.js';
import {
  shouldStripUiParameter,
  stripUiParameter,
} from './hooks/tool-definition.js';
import { transformToolExecuteBefore } from './hooks/tool-execute.js';
import { runToolExecuteAfter } from './hooks/tool-execute-after.js';
import type {
  CapsInjector,
  ChatMessageInput,
  ChatMessageOutput,
  CommandExecuteBeforeInput,
  CommandExecuteBeforeOutput,
  HookFactories,
  LoopCommandManager,
  NudgeCoordinator,
  SyntaxCheckHook,
  ToolDefinitionInput,
  ToolDefinitionOutput,
  ToolExecuteAfterInput,
  ToolExecuteAfterOutput,
  ToolExecuteBeforeInput,
  ToolExecuteBeforeOutput,
  ToolOutputDeduper,
} from './hooks/types.js';

const DEFAULT_EXCLUDED_AGENTS = ['browser', 'greper', 'executor', 'title'];

function createChatMessageHandler(nudgeHook: NudgeCoordinator) {
  return async (
    input: ChatMessageInput,
    output: ChatMessageOutput,
  ): Promise<void> => {
    const agent = resolveAgent(input);
    await nudgeHook.handleChatMessage({
      sessionID: input.sessionID,
      agent,
      parts: output.parts,
    });

    const tools = resolveChatTools(agent, output.message.tools);
    if (tools) output.message.tools = tools;
  };
}

function createMessagesTransformHandler(
  capsInjector: CapsInjector,
  toolOutputDeduper: ToolOutputDeduper,
  nudgeHook: NudgeCoordinator,
) {
  return async (
    _input: Record<string, never>,
    output: { messages: unknown[] },
  ): Promise<void> => {
    await runMessagesTransform(
      capsInjector,
      toolOutputDeduper,
      nudgeHook,
      output,
    );
  };
}

function createToolDefinitionHandler() {
  return async (
    input: ToolDefinitionInput,
    output: ToolDefinitionOutput,
  ): Promise<void> => {
    if (!shouldStripUiParameter(input)) return;
    const next = stripUiParameter(output.parameters);
    output.parameters.properties = next.properties;
    output.parameters.required = next.required;
  };
}

function createToolExecuteBeforeHandler() {
  return async (
    input: ToolExecuteBeforeInput,
    output: ToolExecuteBeforeOutput,
  ): Promise<void> => {
    const result = transformToolExecuteBefore(input, output.args);
    if (result._tag === 'Err') {
      output.args._ui = result.error;
      return;
    }
    if (result.value._ui !== undefined) output.args._ui = result.value._ui;
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
    await runToolExecuteAfter(syntaxCheckHook, nudgeHook, input, output);
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
    await runCommandExecuteBefore(loopCommandManager, nudgeHook, input, output);
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
    'tool.definition': createToolDefinitionHandler(),
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
