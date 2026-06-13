export { formatOllamaWebError } from './error.js';
export { executeOllamaFetch, executeOllamaSearch } from './execute.js';
export {
  createOllamaWebFetchTool,
  createOllamaWebSearchTool,
} from './tools.js';
export type {
  OllamaWebDeps,
  OllamaWebError,
  ToolContext,
  WebFetchArgs,
  WebSearchArgs,
} from './types.js';
