import { createEditorTool } from "./tools/editor.js";
import { createGreperTool } from "./tools/greper.js";
import { createReverieTool } from "./tools/reverie.js";
import { createExecutorTool } from "./tools/executor.js";
import { createBrowserTool } from "./tools/browser.js";
import { createSubmitReviewTool } from "./tools/submitReview.js";
import { createWebsearchTool } from "./tools/websearch.js";
import { createWebfetchTool } from "./tools/webfetch.js";
import { createFuzzyGrepTool } from "./tools/fuzzyGrep.js";
import { createFuzzyFindTool } from "./tools/fuzzyFind.js";
import { createWriteTool } from "./tools/write.js";
import { createReadTool } from "./tools/read.js";
import { execute } from "engine/executor";
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
  readonly executor: ToolDefinition;
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
    executor: createExecutorTool(deps, { execute }),
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
