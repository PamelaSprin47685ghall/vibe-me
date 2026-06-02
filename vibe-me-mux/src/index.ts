import { createCapsInjector } from "./context/capsInjector";
import { createEventHook } from "./eventHook";
import { createEditorTool } from "./tools/editor";
import { createGreperTool } from "./tools/greper";
import { createReverieTool } from "./tools/reverie";
import { createRunnerTool } from "./tools/runner";
import { createRunnerWaitTool } from "./tools/runnerWait";
import { createRunnerAbortTool } from "./tools/runnerAbort";
import { createBrowserTool } from "./tools/browser";
import { createSubmitReviewTool } from "./tools/submitReview";
import { createWebsearchTool } from "./tools/websearch";
import { createWebfetchTool } from "./tools/webfetch";
import { createFuzzyGrepTool } from "./tools/fuzzyGrep";
import { createFuzzyFindTool } from "./tools/fuzzyFind";
import { createStartReviewLoopTool } from "./tools/startReviewLoop";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck";
import type {
  SchemaFactory,
  ToolDefinition,
  ToolWrapper,
  ToolLike,
  PluginToolArgs,
} from "./types/contract";
import type { HostDependencies } from "./types/deps";
import type {
  ContextInjectorRegistration,
  PluginEventHook,
} from "./types/tool";

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
} from "./types/contract";
export type {
  ContextInjectorRegistration,
  PluginEvent,
  PluginEventHelpers,
  PluginEventHook,
  PluginToolConfiguration,
} from "./types/tool";
export type { HostDependencies, RuntimeHandle } from "./types/deps";
