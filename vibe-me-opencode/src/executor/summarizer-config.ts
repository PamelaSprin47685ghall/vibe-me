import { EXECUTOR_SUMMARIZER_SYSTEM_PROMPT } from 'engine/executor';

export function getExecutorSummarizerConfig() {
  return {
    agents: {
      summarizer: {
        prompt: EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: [],
        tools: {
          agent_report: true,
          read: false,
          write: false,
          edit: false,
          glob: false,
          grep: false,
          fuzzy_find: false,
          fuzzy_grep: false,
          webfetch: false,
          websearch: false,
          browser: false,
          executor: false,
          task: false,
          patch: false,
        },
        permission: {
          edit: 'deny',
          write: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
          read: 'deny',
          executor: 'deny',
          webfetch: 'deny',
          websearch: 'deny',
          browser: 'deny',
          bash: 'deny',
        } as Record<string, unknown>,
      },
    },
  };
}
