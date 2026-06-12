import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import { createBrowserTool } from '../browser/index.js';
import { createEditorTool } from '../editor/index.js';
import { createFuzzyFindTool, createFuzzyGrepTool } from '../fuzzy/index.js';
import { createGreperTool } from '../greper/index.js';
import { createSubmitReviewResultTool, createSubmitReviewTool } from '../loop/index.js';
import { createOllamaWebFetchTool, createOllamaWebSearchTool } from '../ollama-web/index.js';
import { createReverieTool } from '../reverie/index.js';
import { createExecutorTool } from '../executor/index.js';

export function createTools(ctx: PluginInput, reviewStore: ReviewStore, nudgeTool: Record<string, unknown>) {
  return {
    ...nudgeTool,
    editor: createEditorTool(ctx),
    greper: createGreperTool(ctx),
    reverie: createReverieTool(ctx),
    submit_review: createSubmitReviewTool(ctx, reviewStore),
    submit_review_result: createSubmitReviewResultTool(reviewStore),
    webfetch: createOllamaWebFetchTool(),
    websearch: createOllamaWebSearchTool(),
    executor: createExecutorTool(ctx),
    browser: createBrowserTool(ctx),
    fuzzy_find: createFuzzyFindTool(),
    fuzzy_grep: createFuzzyGrepTool(),
  };
}
