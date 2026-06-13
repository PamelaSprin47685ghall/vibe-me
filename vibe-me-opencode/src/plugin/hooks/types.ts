import type { PluginInput } from '@opencode-ai/plugin';

export type NudgeCoordinator = {
  handleChatMessage(props: {
    sessionID: string;
    agent: string;
    parts: unknown[];
  }): Promise<void>;
  handleMessagesTransform(output: { messages: unknown[] }): Promise<void>;
  handleToolExecuteAfter(
    input: { tool: string; sessionID?: string; callID: string },
    output: {
      output?: unknown;
      title?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
  handleCommandExecuteBefore(
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string }> },
  ): Promise<void>;
  handleEvent(input: {
    event: { type: string; properties?: Record<string, unknown> };
  }): Promise<void>;
};

export type LoopCommandManager = {
  handleCommandExecuteBefore(
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string }> },
  ): Promise<void>;
};

export type CapsInjector = {
  handleMessagesTransform(output: { messages: unknown[] }): Promise<void>;
};

export type ToolOutputDeduper = {
  handleMessagesTransform(output: { messages: unknown[] }): Promise<void>;
};

export type SyntaxCheckHook = {
  'tool.execute.after'(
    input: { tool: string },
    output: {
      output?: unknown;
      title?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
};

export type HookFactories = {
  createCapsMessagesInjector: (
    directory: string,
    excludedAgents: string[],
  ) => CapsInjector;
  createToolOutputDeduper: () => ToolOutputDeduper;
  createSyntaxCheckHook: (ctx: PluginInput) => SyntaxCheckHook;
};

export type ChatMessageInput = { agent?: string; sessionID: string };
export type ChatMessageOutput = {
  parts: unknown[];
  message: { tools?: Record<string, unknown> };
};

export type ToolDefinitionInput = { toolID: string };
export type ToolDefinitionOutput = {
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolExecuteBeforeInput = {
  tool: string;
  sessionID: string;
  callID: string;
};
export type ToolExecuteBeforeOutput = {
  args: { intents?: unknown; _ui?: string };
};

export type ToolExecuteAfterInput = {
  tool: string;
  sessionID?: string;
  callID: string;
};
export type ToolExecuteAfterOutput = {
  output?: unknown;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type CommandExecuteBeforeInput = {
  command: string;
  sessionID: string;
  arguments: string;
};
export type CommandExecuteBeforeOutput = {
  parts: Array<{ type: string; text?: string }>;
};

export type EventInput = {
  event: { type: string; properties?: Record<string, unknown> };
};
