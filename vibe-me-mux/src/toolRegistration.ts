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
import { execute, cleanupJob, globalJobRegistry } from "engine/runner";
import { EXTENDED_SHELL_READ_COMMANDS } from "engine/runner/read-commands";
import { tryLockReview, isReviewActive, getReviewTask, deactivateReview, unlockReview } from "engine/review";
import { delegateToSubAgent } from "./tools/delegate.js";
import type { HostDependencies } from "./types/deps.js";
import type { ToolDefinition } from "./types/contract.js";

export type ExecuteHostFileRead = (
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

export function createToolCatalog(
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
