import { mock } from 'bun:test';
import type { PluginInput } from '@opencode-ai/plugin';
import { defaultCoordinator } from 'engine/todo';

export function createMockContext() {
  return {
    directory: '/tmp/test-project',
    client: {
      session: {
        create: mock(() => ({ data: { id: 'reviewer-1' } })),
        prompt: mock(() => {}),
        messages: mock(() => ({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'working on it' }],
            },
          ],
        })),
        todo: mock(() => ({ data: [{ id: 'todo-1', content: 'finish task', status: 'in_progress', priority: 'high' }] })),
      },
    },
  } as unknown as PluginInput;
}

export function cleanupAfterEach() {
  defaultCoordinator.clear();
}