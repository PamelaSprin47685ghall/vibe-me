import { RUNNER_SYSTEM_PROMPT } from 'engine/runner';

export function getRunnerConfig() {
  return {
    agents: {
      runner: {
        prompt: RUNNER_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: [],
        permission: {
          edit: 'deny',
          write: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
          read: 'deny',
          runner_wait: 'allow',
          runner_abort: 'allow',
        } as Record<string, unknown>,
      },
    },
  };
}
