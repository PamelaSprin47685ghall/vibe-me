import { describe, expect, it } from 'vitest';
import { editorRole, reverieRole } from '../types/agent-policy.js';
import type { AgentRole } from '../types/agent-policy.js';
import {
  delegateIntents,
  buildReveriePrompt,
  SUBAGENT_REPORT_SEPARATOR,
  type HostAdapter,
  type SubagentRequest,
} from './index.js';

function recordingAdapter(): {
  adapter: HostAdapter;
  calls: SubagentRequest[];
} {
  const calls: SubagentRequest[] = [];
  const adapter: HostAdapter = {
    promptSubagent: async (request) => {
      calls.push(request);
      return `report:${request.prompt}`;
    },
  };
  return { adapter, calls };
}

describe('delegateIntents', () => {
  it('fans out each intent to the adapter with role and title', async () => {
    const { adapter, calls } = recordingAdapter();
    const role: AgentRole = editorRole;
    const result = await delegateIntents(adapter, role, 'Editor', ['a', 'b']);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ role, prompt: 'a', title: 'Editor' });
    expect(calls[1]).toEqual({ role, prompt: 'b', title: 'Editor' });
    expect(result).toBe(`report:a${SUBAGENT_REPORT_SEPARATOR}report:b`);
  });

  it('returns a single report with no separator for one intent', async () => {
    const { adapter } = recordingAdapter();
    const result = await delegateIntents(adapter, editorRole, 'Editor', ['only']);
    expect(result).toBe('report:only');
  });

  it('returns empty string for zero intents', async () => {
    const { adapter, calls } = recordingAdapter();
    const result = await delegateIntents(adapter, editorRole, 'Editor', []);
    expect(calls).toHaveLength(0);
    expect(result).toBe('');
  });
});

describe('buildReveriePrompt', () => {
  it('renders file sections then the question', () => {
    const prompt = buildReveriePrompt(
      [
        { file: 'src/a.ts', content: 'AAA' },
        { file: 'src/b.ts', content: 'BBB' },
      ],
      'why?',
    );
    expect(prompt).toBe(
      '=== src/a.ts ===\n\nAAA\n=== src/b.ts ===\n\nBBB\nQuestion:\nwhy?',
    );
  });

  it('marks missing content as (skipped)', () => {
    const prompt = buildReveriePrompt(
      [{ file: 'gone.ts', content: undefined }],
      'q',
    );
    expect(prompt).toBe('=== gone.ts ===\n\n(skipped)\nQuestion:\nq');
  });

  it('uses reverieRole as a valid AgentRole in delegation', async () => {
    const { adapter, calls } = recordingAdapter();
    await delegateIntents(adapter, reverieRole, 'Reverie', ['x']);
    expect(calls[0]!.role).toBe(reverieRole);
  });
});
