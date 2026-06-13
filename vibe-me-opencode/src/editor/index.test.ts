import { describe, expect, test, vi } from 'vitest';
import { createEditorTool, getEditorConfig } from './index';

describe('getEditorConfig', () => {
  test('returns editor agent with tools and permissions', () => {
    const cfg = getEditorConfig();
    expect(cfg.agents.editor.mode).toBe('subagent');
    expect(cfg.agents.editor.prompt).toContain('code editing');
    expect(cfg.agents.editor.permission).toMatchObject({
      read: 'allow',
      write: 'allow',
      edit: 'allow',
      bash: 'deny',
      glob: 'allow',
      grep: 'deny',
      fuzzy_find: 'allow',
      fuzzy_grep: 'allow',
      task: 'deny',
    });
  });
});

describe('createEditorTool', () => {
  function mockCtx() {
    return {
      client: {
        session: {
          create: vi.fn(async () => ({ data: { id: 'editor-child-1' } })),
          prompt: vi.fn(async () => ({})),
          messages: vi.fn(async () => ({
            data: [
              {
                info: { role: 'assistant' },
                parts: [
                  {
                    type: 'text',
                    text: 'Changed src/foo.ts: renamed bar to baz',
                  },
                ],
              },
            ],
          })),
          abort: vi.fn(async () => ({})),
        },
      },
    } as any;
  }

  test('returns summary from child session', async () => {
    const ctx = mockCtx();
    const editor = createEditorTool(ctx);
    const result = await editor.execute(
      { intents: [['Rename bar to baz in src/foo.ts', ['src/foo.ts']]] },
      {} as any,
    );
    expect(result).toContain('Changed src/foo.ts');
    expect(ctx.client.session.create).toHaveBeenCalled();
    expect(ctx.client.session.prompt).toHaveBeenCalled();
  });

  test('sends task to child session', async () => {
    const ctx = mockCtx();
    const editor = createEditorTool(ctx);
    await editor.execute(
      { intents: [['Add isEven function to src/utils.ts', ['src/utils.ts']]] },
      {} as any,
    );
    const promptArg = ctx.client.session.prompt.mock.calls[0][0];
    const text = promptArg.body.parts[0].text;
    expect(text).toContain('Add isEven function to src/utils.ts');
    expect(text).toContain('src/utils.ts');
  });

  test('uses editor agent', async () => {
    const ctx = mockCtx();
    const editor = createEditorTool(ctx);
    await editor.execute(
      { intents: [['Fix bug in main.ts', ['main.ts']]] },
      {} as any,
    );
    const promptArg = ctx.client.session.prompt.mock.calls[0][0];
    expect(promptArg.body.agent).toBe('editor');
  });

  test('handles multiple intents and joins results', async () => {
    const ctx = mockCtx();
    const editor = createEditorTool(ctx);
    const result = await editor.execute(
      {
        intents: [
          ['Refactor foo.ts', ['foo.ts']],
          ['Update bar.ts', ['bar.ts']],
        ],
      },
      {} as any,
    );
    expect(result).toContain('Changed src/foo.ts');
    expect(result).toContain('---');
  });
});
