import type { PluginInput } from '@opencode-ai/plugin';
import { vi } from 'vitest';

export function createMockContext() {
  return {
    directory: '/tmp/test-project',
    client: {
      session: {
        create: vi.fn(() => ({ data: { id: 'reviewer-1' } })),
        prompt: vi.fn(() => {}),
        messages: vi.fn(() => ({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'null' }],
            },
          ],
        })),
        todo: vi.fn(() => ({ data: [] })),
      },
    },
  } as unknown as PluginInput;
}

export function createOutput() {
  return {
    parts: [{ type: 'text', text: 'template content' }] as Array<{
      type: string;
      text?: string;
    }>,
  };
}
