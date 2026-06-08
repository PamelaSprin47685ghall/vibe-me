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
import { createStartReviewLoopTool } from "./tools/startReviewLoop.js";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck.js";
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

const STEALTH_BROWSER_MCP_REPO = "https://github.com/vibheksoni/stealth-browser-mcp.git";
const STEALTH_BROWSER_MCP_REF = process.env.STEALTH_BROWSER_MCP_REF ?? "master";

export const stealthBrowserMcpCommand = [
  "uvx",
  "--python",
  "3.13",
  "--from",
  `git+${STEALTH_BROWSER_MCP_REPO}@${STEALTH_BROWSER_MCP_REF}`,
  "python",
  "-m",
  "server",
].join(" ");

export function getMcpServers(): Readonly<Record<string, string>> {
  return {
    "stealth-browser-mcp": stealthBrowserMcpCommand,
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
  const readDef = createReadTool(deps);

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

  const websearchDef = createWebsearchTool(deps);
  const webfetchDef = createWebfetchTool(deps);

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    mcpServers: getMcpServers(),
    wrappers: [
      ...createSyntaxCheckWrappers(deps.log),
      createWebOverrideWrapper(websearchDef, "web_search"),
      createWebOverrideWrapper(webfetchDef, "web_fetch"),
      createWebOverrideWrapper(readDef, "file_read"),
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
export type { AgentToolPolicy } from "./types/tool.js";
export type { MuxAgentName, SubAgentRole, MuxAgentToolPolicies } from "./agentToolPolicies.js";
export { buildAgentToolPolicies, getPluginToolPolicy } from "./agentToolPolicies.js";
export { findCapsFiles, type CapsFileInfo } from "engine/caps";
export { buildCapsFileReadData, type CapsFileReadEntry } from "./context/capsFileReadMessages.js";
export { deduplicateReadOutputs } from "./dedup/index.js";
