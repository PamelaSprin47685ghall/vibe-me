import { describe, expect, it } from 'vitest';
import { getExecutorSummarizerConfig } from './index';

describe('getExecutorSummarizerConfig', () => {
  it('returns summarizer agent restricted to agent_report', () => {
    const cfg = getExecutorSummarizerConfig();
    expect(cfg.agents.summarizer.mode).toBe('subagent');
    expect(cfg.agents.summarizer.tools).toMatchObject({ agent_report: true });
    expect(cfg.agents.summarizer.permission).toMatchObject({
      read: 'deny',
      write: 'deny',
      edit: 'deny',
      executor: 'deny',
      task: 'deny',
    });
  });
});
