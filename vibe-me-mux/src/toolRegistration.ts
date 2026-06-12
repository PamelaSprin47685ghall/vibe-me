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
import { execute, cleanupJob } from "engine/runner";
import { type ReviewStore } from "engine/review";
import { delegateToSubAgent } from "./tools/delegate.js";
import type { HostDependencies } from "./types/deps.js";
import type { ToolDefinition } from "./types/contract.js";

export type ExecuteHostFileRead = (
  args: unknown,
  options?: { readonly abortSignal?: AbortSignal },
) => Promise<unknown>;

type ToolCatalog = {
  readonly editor: ToolDefinition;
  readonly greper: ToolDefinition;
  readonly reverie: ToolDefinition;
  readonly runner: ToolDefinition;
  readonly runner_wait: ToolDefinition;
  readonly runner_abort: ToolDefinition;
  readonly browser: ToolDefinition;
  readonly submit_review: ToolDefinition;
  readonly websearch: ToolDefinition;
  readonly webfetch: ToolDefinition;
  readonly fuzzy_grep: ToolDefinition;
  readonly fuzzy_find: ToolDefinition;
  readonly write: ToolDefinition;
  readonly read: ToolDefinition;
};

export function createToolCatalog(
  deps: HostDependencies,
  executeHostFileRead: ExecuteHostFileRead,
  reviewStore: ReviewStore,
): ToolCatalog {
  return {
    editor: createEditorTool(deps),
    greper: createGreperTool(deps),
    reverie: createReverieTool(deps),
    runner: createRunnerTool(deps, {
      execute,
      cleanupJob: (jobId) => cleanupJob(deps.runnerJobs, jobId),
      globalJobRegistry: deps.runnerJobs,
    }),
    runner_wait: createRunnerWaitTool(deps),
    runner_abort: createRunnerAbortTool(deps),
    browser: createBrowserTool(deps),
    submit_review: createSubmitReviewTool(deps, {
      reviewStore,
      delegateToSubAgent,
    }),
    websearch: createWebsearchTool(deps),
    webfetch: createWebfetchTool(deps),
    fuzzy_grep: createFuzzyGrepTool(deps),
    fuzzy_find: createFuzzyFindTool(deps),
    write: createWriteTool(deps),
    read: createReadTool(deps, executeHostFileRead),
  };
}