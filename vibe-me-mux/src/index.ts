import { createCapsInjector } from "./context/capsInjector.js";
import { createEventHook } from "./eventHook.js";
import { cleanupRegistry, cleanupJob, execute, globalJobRegistry, hasActiveJob, buildRunnerNudgePrompt } from "engine/runner";
import { EXTENDED_SHELL_READ_COMMANDS } from "engine/runner/read-commands";
import { deactivateReview, isReviewActive, tryLockReview, getReviewTask, unlockReview } from "engine/review";
import { delegateToSubAgent } from "./tools/delegate.js";
import { globalIteratorStore } from "engine/util";
import { defaultCoordinator, TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT } from "engine/todo";
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

type ExecuteHostFileRead = (
  args: unknown,
  options?: { readonly abortSignal?: AbortSignal },
) => Promise<unknown>;

type ToolFactory = (deps: HostDependencies) => ToolDefinition;

const TOOL_FACTORIES = {
  editor: createEditorTool,
  greper: createGreperTool,
  reverie: createReverieTool,
  runner: (deps: HostDependencies) => createRunnerTool(deps, {
    execute,
    cleanupJob,
    globalJobRegistry,
    extendedShellReadCommands: EXTENDED_SHELL_READ_COMMANDS,
  }),
  runner_wait: createRunnerWaitTool,
  runner_abort: createRunnerAbortTool,
  browser: createBrowserTool,
  submit_review: (deps: HostDependencies) =>
    createSubmitReviewTool(deps, {
      tryLockReview,
      isReviewActive,
      getReviewTask,
      deactivateReview,
      unlockReview,
      delegateToSubAgent,
    }),
  websearch: createWebsearchTool,
  webfetch: createWebfetchTool,
  fuzzy_grep: createFuzzyGrepTool,
  fuzzy_find: createFuzzyFindTool,
  write: createWriteTool,
} satisfies Record<string, ToolFactory>;

type OrdinaryToolCatalog = {
  readonly [ToolName in keyof typeof TOOL_FACTORIES]: ToolDefinition;
};

type ToolCatalog = OrdinaryToolCatalog & {
  readonly read: ToolDefinition;
};

function createToolCatalog(
  deps: HostDependencies,
  executeHostFileRead: ExecuteHostFileRead,
): ToolCatalog {
  const ordinaryToolCatalog = Object.fromEntries(
    Object.entries(TOOL_FACTORIES).map(([toolName, createTool]) => [toolName, createTool(deps)]),
  ) as OrdinaryToolCatalog;

  return {
    ...ordinaryToolCatalog,
    read: createReadTool(deps, executeHostFileRead),
  };
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
  let hostFileReadExecute: ExecuteHostFileRead | undefined;

  const executeHostFileRead = (
    args: unknown,
    opts?: { readonly abortSignal?: AbortSignal },
  ): Promise<unknown> => {
    if (hostFileReadExecute === undefined) {
      throw new Error("Host file_read wrapper has not been initialized");
    }

    return hostFileReadExecute(args, opts);
  };

  const catalog = createToolCatalog(deps, executeHostFileRead);
  const tools = Object.values(catalog);

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    mcpServers: getMcpServers(),
    wrappers: [
      ...createSyntaxCheckWrappers(deps.log),
      createWebOverrideWrapper(catalog.websearch, "web_search"),
      createWebOverrideWrapper(catalog.webfetch, "web_fetch"),
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
    eventHook: createEventHook({
      cleanupRegistry,
      globalJobRegistry,
      deactivateReview,
      isReviewActive,
      clearIteratorScope: globalIteratorStore.clearScope.bind(globalIteratorStore),
      coordinator: defaultCoordinator,
      hasActiveJob,
      buildRunnerNudgePrompt,
      TODO_NUDGE_PROMPT,
      LOOP_NUDGE_PROMPT,
    }),
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
