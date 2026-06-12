export { createLoopCommandManager } from './command';
export { runReviewerWithNudge } from './reviewer';
export { createSubmitReviewResultTool, createSubmitReviewTool } from './tools';
export { createDeferred, type Deferred, type ReviewResult } from './types';

export function getReviewerConfig() {
  return {
    agents: {
      reviewer: {
        prompt: 'You are a code reviewer...',
        mode: 'subagent' as const,
        mcps: [],
        permission: {
          read: 'allow',
          bash: 'deny',
          edit: 'deny',
          write: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
        } as Record<string, unknown>,
      },
    },
  };
}
