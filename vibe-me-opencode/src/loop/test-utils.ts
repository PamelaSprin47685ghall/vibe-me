import { mock } from 'bun:test';

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
              parts: [{ type: 'text', text: 'null' }],
            },
          ],
        })),
        todo: mock(() => ({ data: [] })),
      },
    },
  } as any;
}

export function createOutput() {
  return {
    parts: [{ type: 'text', text: 'template content' }] as Array<{
      type: string;
      text?: string;
    }>,
  };
}
