import type { PluginInput } from '@opencode-ai/plugin';
import { defaultCoordinator } from 'engine/todo';
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
              parts: [{ type: 'text', text: 'working on it' }],
            },
          ],
        })),
        todo: vi.fn(() => ({
          data: [
            {
              id: 'todo-1',
              content: 'finish task',
              status: 'in_progress',
              priority: 'high',
            },
          ],
        })),
      },
    },
  } as unknown as PluginInput;
}

export function cleanupAfterEach() {
  defaultCoordinator.clear();
}
