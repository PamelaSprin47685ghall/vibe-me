import type { PluginInput } from '@opencode-ai/plugin';
import { createBrowserTool } from '../browser/index.js';
import { createEditorTool } from '../editor/index.js';
import { createFuzzyFindTool, createFuzzyGrepTool } from '../fuzzy/index.js';
import { createGreperTool } from '../greper/index.js';
import { createSubmitReviewResultTool, createSubmitReviewTool } from '../loop/index.js';
import { createOllamaWebFetchTool, createOllamaWebSearchTool } from '../ollama-web/index.js';
import { createReverieTool } from '../reverie/index.js';
import { createRunnerAbortTool, createRunnerTool, createRunnerWaitTool } from '../runner/index.js';

export function createTools(ctx: PluginInput, nudgeTool: Record<string, unknown>) {
  return {
    ...nudgeTool,
    editor: createEditorTool(ctx),
    greper: createGreperTool(ctx),
    reverie: createReverieTool(ctx),
    submit_review: createSubmitReviewTool(ctx),
    submit_review_result: createSubmitReviewResultTool(),
    webfetch: createOllamaWebFetchTool(),
    websearch: createOllamaWebSearchTool(),
    runner: createRunnerTool(ctx),
    browser: createBrowserTool(ctx),
    fuzzy_find: createFuzzyFindTool(),
    fuzzy_grep: createFuzzyGrepTool(),
    runner_wait: createRunnerWaitTool(),
    runner_abort: createRunnerAbortTool(),
  };
}