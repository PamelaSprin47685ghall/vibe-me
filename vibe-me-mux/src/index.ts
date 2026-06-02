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
import { bindResolveDeps } from "./tools/resolveDelegatedAgentAiSettings";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck";
import { webFetchOverride, webSearchOverride } from "./wrappers/webOverride";
import type { HostDependencies } from "./types/deps";
import type {
  ContextInjectorRegistration,
  PluginEventHook,
  ToolFactoryRegistration,
  ToolWrapperRegistration,
} from "./types/tool";

export interface PluginRegistration {
  toolNames: readonly string[];
  tools: ToolFactoryRegistration[];
  wrappers: ToolWrapperRegistration[];
  contextInjector: ContextInjectorRegistration;
  eventHook: PluginEventHook;
}

/**
 * Single static entry point. The host calls this once at startup and
 * binds the returned `PluginRegistration` to its tool pipeline.
 */
export function createRegistration(deps: HostDependencies): PluginRegistration {
  bindResolveDeps(deps);

  const tools: ToolFactoryRegistration[] = [
    { name: "editor", factory: createEditorTool },
    { name: "greper", factory: createGreperTool },
    { name: "reverie", factory: createReverieTool },
    { name: "runner", factory: createRunnerTool },
    { name: "runner_wait", factory: createRunnerWaitTool },
    { name: "runner_abort", factory: createRunnerAbortTool },
    { name: "browser", factory: createBrowserTool },
    { name: "submit_review", factory: createSubmitReviewTool },
    { name: "websearch", factory: createWebsearchTool },
    { name: "webfetch", factory: createWebfetchTool },
    { name: "fuzzy_grep", factory: createFuzzyGrepTool },
    { name: "fuzzy_find", factory: createFuzzyFindTool },
    { name: "start_review_loop", factory: createStartReviewLoopTool },
  ];

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    wrappers: [webSearchOverride, webFetchOverride, ...createSyntaxCheckWrappers(deps.log)],
    contextInjector: createCapsInjector(),
    eventHook: createEventHook(),
  };
}

export type {
  ContextInjectorRegistration,
  PluginEvent,
  PluginEventHelpers,
  PluginEventHook,
  PluginToolConfiguration,
  ToolFactory,
  ToolFactoryRegistration,
  ToolWrapperRegistration,
} from "./types/tool";
export type { HostDependencies } from "./types/deps";
