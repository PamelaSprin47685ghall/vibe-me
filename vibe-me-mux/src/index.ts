import { createCapsInjector } from "./context/capsInjector.js";
import { createEventHook } from "./eventHook.js";
import { createEditorTool } from "./tools/editor.js";
import { createGreperTool } from "./tools/greper.js";
import { createReverieTool } from "./tools/reverie.js";
import { createRunnerTool } from "./tools/runner.js";
import { createRunnerWaitTool } from "./tools/runnerWait.js";
import { createRunnerAbortTool } from "./tools/runnerAbort.js";
import { createBrowserTool } from "./tools/browser.js";
import { createSubmitReviewTool } from "./tools/submitReview.js";
import { createWebsearchTool } from "./tools/websearch.js";
import { createWebfetchTool } from "./tools/webfetch.js";
import { createFuzzyGrepTool } from "./tools/fuzzyGrep.js";
import { createFuzzyFindTool } from "./tools/fuzzyFind.js";
import { createWriteTool } from "./tools/write.js";
import { createReadTool } from "./tools/read.js";
import { getStealthBrowserMcpCommand } from "engine/mcp";
import { createStartReviewLoopTool } from "./tools/startReviewLoop.js";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck.js";
import { createTodoWriteNudgeWrapper } from "./wrappers/todoWriteNudge.js";
import { createLoopCommand } from "./commands/loop.js";
import {
  buildAgentToolPolicies,
  type MuxAgentToolPolicies,
} from "./agentToolPolicies.js";
import type {
  ToolDefinition,
  ToolWrapper,
  ToolLike,
  PluginToolArgs,
} from "./types/contract.js";
import type { HostDependencies } from "./types/deps.js";
import type {
  ContextInjectorRegistration,
  PluginEventHook,
  PluginSlashCommandDefinition,
} from "./types/tool.js";

export interface PluginRegistration {
  readonly toolNames: readonly string[];
  readonly tools: readonly ToolDefinition[];
  readonly wrappers: readonly ToolWrapper[];
  readonly mcpServers: Readonly<Record<string, string>>;
  readonly contextInjector: ContextInjectorRegistration;
  readonly eventHook: PluginEventHook;
  readonly slashCommands: readonly PluginSlashCommandDefinition[];
  readonly agentToolPolicies: MuxAgentToolPolicies;
}

export function getMcpServers(): Readonly<Record<string, string>> {
  return {
    "stealth-browser-mcp": getStealthBrowserMcpCommand(),
  };
}

function requireToolDefinition(
  tools: readonly ToolDefinition[],
  toolName: string,
): ToolDefinition {
  const toolDefinition = tools.find((tool) => tool.name === toolName);

  if (toolDefinition === undefined) {
    throw new Error(`Missing tool definition: ${toolName}`);
  }

  return toolDefinition;
}

function createWebOverrideWrapper(
  def: ToolDefinition,
  targetTool: string,
): ToolWrapper {
  return {
    targetTool,
    wrapper: (_tool, config) => ({
      description: def.description,
      parameters: def.parameters,
      execute: (args: PluginToolArgs, options?: { readonly abortSignal?: AbortSignal }) =>
        def.execute(
          { ...config, abortSignal: options?.abortSignal },
          args,
        ),
    }) as ToolLike,
  };
}

export function createRegistration(
  deps: HostDependencies,
): PluginRegistration {
  let hostFileReadExecute: ((args: unknown, options?: { readonly abortSignal?: AbortSignal }) => Promise<unknown>) | undefined;

  const executeHostFileRead = (
    args: unknown,
    opts?: { readonly abortSignal?: AbortSignal },
  ): Promise<unknown> => {
    if (hostFileReadExecute === undefined) {
      throw new Error("Host file_read wrapper has not been initialized");
    }

    return hostFileReadExecute(args, opts);
  };

  const readDef = createReadTool(deps, executeHostFileRead);

  const tools: ToolDefinition[] = [
    createEditorTool(deps),
    createGreperTool(deps),
    createReverieTool(deps),
    createRunnerTool(deps),
    createRunnerWaitTool(deps),
    createRunnerAbortTool(deps),
    createBrowserTool(deps),
    createSubmitReviewTool(deps),
    createWebsearchTool(deps),
    createWebfetchTool(deps),
    createFuzzyGrepTool(deps),
    createFuzzyFindTool(deps),
    createWriteTool(deps),
    createStartReviewLoopTool(deps),
    readDef,
  ];

  const websearchDef = requireToolDefinition(tools, "websearch");
  const webfetchDef = requireToolDefinition(tools, "webfetch");

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    mcpServers: getMcpServers(),
    wrappers: [
      ...createSyntaxCheckWrappers(deps.log),
      createWebOverrideWrapper(websearchDef, "web_search"),
      createWebOverrideWrapper(webfetchDef, "web_fetch"),
      {
        targetTool: "file_read",
        wrapper: (hostTool) => {
          hostFileReadExecute = (hostTool as { execute: (...a: readonly unknown[]) => Promise<unknown> }).execute.bind(hostTool);
          return { execute: async () => "disabled" } as ToolLike;
        },
      },
      createTodoWriteNudgeWrapper(),
    ],
    contextInjector: createCapsInjector(),
    eventHook: createEventHook(),
    slashCommands: createLoopCommand(deps),
    agentToolPolicies: buildAgentToolPolicies(),
  };
}

export type {
  ToolDefinition,
  ToolLike,
  ToolWrapper,
  BrowserToolArgs,
  EditorToolArgs,
  GreperToolArgs,
  ReverieToolArgs,
  RunnerToolArgs,
  RunnerWaitToolArgs,
  RunnerAbortToolArgs,
  StartReviewLoopToolArgs,
  SubmitReviewToolArgs,
  WebsearchToolArgs,
  WebfetchToolArgs,
  FuzzyGrepToolArgs,
  FuzzyFindToolArgs,
  WriteToolArgs,
  ReadToolArgs,
} from "./types/contract.js";
export type {
  ContextInjectorRegistration,
  PluginEvent,
  PluginEventHelpers,
  PluginEventHook,
  PluginSlashCommandDefinition,
  PluginToolConfiguration,
} from "./types/tool.js";
export type { HostDependencies, RuntimeHandle, TaskServiceLike, TaskCreateInput, TaskWaitOptions, TaskCreateResult } from "./types/deps.js";
export type { MuxPluginToolPolicy } from "./types/tool.js";
export type { MuxAgentName, SubAgentRole, MuxAgentToolPolicies } from "./agentToolPolicies.js";
export { buildAgentToolPolicies, getPluginToolPolicy } from "./agentToolPolicies.js";
export { findCapsFiles, type CapsFileInfo } from "engine/caps";
export { buildCapsFileReadData, type CapsFileReadEntry } from "./context/capsFileReadMessages.js";
export { deduplicateReadOutputs } from "./dedup/index.js";
