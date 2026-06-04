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
import { createStartReviewLoopTool } from "./tools/startReviewLoop.js";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck.js";
import type {
  SchemaFactory,
  ToolDefinition,
  ToolWrapper,
  ToolLike,
  PluginToolArgs,
} from "./types/contract.js";
import type { HostDependencies } from "./types/deps.js";
import type {
  ContextInjectorRegistration,
  PluginEventHook,
} from "./types/tool.js";

export interface PluginRegistration<S> {
  readonly toolNames: readonly string[];
  readonly tools: readonly ToolDefinition<S>[];
  readonly wrappers: readonly ToolWrapper[];
  readonly contextInjector: ContextInjectorRegistration;
  readonly eventHook: PluginEventHook;
}

function createWebOverrideWrapper<S>(
  def: ToolDefinition<S>,
  targetTool: string,
): ToolWrapper {
  return {
    targetTool,
    wrapper: (_tool, config) => ({
      description: def.description,
      parameters: def.schema.raw as object,
      execute: (args: PluginToolArgs, options?: { readonly abortSignal?: AbortSignal }) =>
        def.execute(
          { ...config, abortSignal: options?.abortSignal },
          args,
        ),
    }) as ToolLike,
  };
}

function createToolDef<S>(
  factory: (deps: HostDependencies, f: SchemaFactory<S>) => ToolDefinition<S>,
  deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  return factory(deps, f);
}

export function createRegistration<S>(
  deps: HostDependencies,
  f: SchemaFactory<S>,
): PluginRegistration<S> {
  const tools: ToolDefinition<S>[] = [
    createToolDef(createEditorTool, deps, f),
    createToolDef(createGreperTool, deps, f),
    createToolDef(createReverieTool, deps, f),
    createToolDef(createRunnerTool, deps, f),
    createToolDef(createRunnerWaitTool, deps, f),
    createToolDef(createRunnerAbortTool, deps, f),
    createToolDef(createBrowserTool, deps, f),
    createToolDef(createSubmitReviewTool, deps, f),
    createToolDef(createWebsearchTool, deps, f),
    createToolDef(createWebfetchTool, deps, f),
    createToolDef(createFuzzyGrepTool, deps, f),
    createToolDef(createFuzzyFindTool, deps, f),
    createToolDef(createStartReviewLoopTool, deps, f),
  ];

  const websearchDef = createWebsearchTool(deps, f);
  const webfetchDef = createWebfetchTool(deps, f);

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    wrappers: [
      ...createSyntaxCheckWrappers(deps.log),
      createWebOverrideWrapper(websearchDef, "web_search"),
      createWebOverrideWrapper(webfetchDef, "web_fetch"),
    ],
    contextInjector: createCapsInjector(),
    eventHook: createEventHook(),
  };
}

export type {
  SchemaFactory,
  SchemaWrapper,
  Infer,
  ToolDefinition,
  ToolLike,
  ToolWrapper,
  PluginToolArgs,
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
} from "./types/contract.js";
export type {
  ContextInjectorRegistration,
  PluginEvent,
  PluginEventHelpers,
  PluginEventHook,
  PluginToolConfiguration,
} from "./types/tool.js";
export type { HostDependencies, RuntimeHandle } from "./types/deps.js";
