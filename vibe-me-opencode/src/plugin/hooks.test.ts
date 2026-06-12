import { describe, expect, it, mock } from 'bun:test';
import type { PluginInput } from '@opencode-ai/plugin';
import { createHooks } from './hooks.js';

type NudgeCoordinator = Parameters<typeof createHooks>[1];
type LoopCommandManager = Parameters<typeof createHooks>[2];
type HookFactories = NonNullable<Parameters<typeof createHooks>[3]>;

function makeFakes() {
  const nudgeHook = {
    tool: {},
    handleChatMessage: mock(() => {}),
    handleMessagesTransform: mock(async () => {}),
    handleToolExecuteAfter: mock(async () => {}),
    handleCommandExecuteBefore: mock(async () => {}),
    handleEvent: mock(async () => {}),
  } as unknown as NudgeCoordinator;

  const loopCommandManager = {
    registerCommand: mock(() => {}),
    handleCommandExecuteBefore: mock(async () => {}),
  } as unknown as LoopCommandManager;

  const capsInjector = { handleMessagesTransform: mock(async () => {}) };
  const toolOutputDeduper = { handleMessagesTransform: mock(async () => {}) };
  const syntaxCheckHook = { 'tool.execute.after': mock(async () => {}) };

  const factories = {
    createCapsMessagesInjector: mock(() => capsInjector),
    createToolOutputDeduper: mock(() => toolOutputDeduper),
    createSyntaxCheckHook: mock(() => syntaxCheckHook),
  } as unknown as HookFactories;

  return {
    nudgeHook,
    loopCommandManager,
    capsInjector,
    toolOutputDeduper,
    syntaxCheckHook,
    factories,
  };
}

describe('createHooks', () => {
  const ctx = { directory: '/test-project' } as unknown as PluginInput;

  it('chat.message sets agent defaults and disables stealth-browser tools for non-browser agents', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const output = {
      parts: [],
      message: { tools: {} as Record<string, unknown> },
    };

    await hooks['chat.message']({ sessionID: 's1' }, output);

    expect(nudgeHook.handleChatMessage).toHaveBeenCalledWith({
      sessionID: 's1',
      agent: 'orchestrator',
      parts: [],
    });
    expect(output.message.tools.patch).toBe(false);
    expect(output.message.tools['stealth-browser-mcp_*']).toBe(false);
    expect(output.message.tools.read).toBe(true);
  });

  it('chat.message does not disable stealth-browser tools for browser', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const output = {
      parts: [],
      message: {
        tools: { 'stealth-browser-mcp_foo': true } as Record<string, unknown>,
      },
    };

    await hooks['chat.message']({ agent: 'browser', sessionID: 's1' }, output);

    expect(output.message.tools['stealth-browser-mcp_foo']).toBe(true);
    expect(output.message.tools['stealth-browser-mcp_*']).toBeUndefined();
    expect(output.message.tools.patch).toBe(false);
  });

  it('chat.message disables existing stealth-browser tools for non-browser agents', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const output = {
      parts: [],
      message: {
        tools: {
          'stealth-browser-mcp_foo': true,
          'stealth-browser-mcp_bar': false,
        } as Record<string, unknown>,
      },
    };

    await hooks['chat.message']({ agent: 'editor', sessionID: 's1' }, output);

    expect(output.message.tools['stealth-browser-mcp_foo']).toBe(false);
    expect(output.message.tools['stealth-browser-mcp_bar']).toBe(false);
    expect(output.message.tools['stealth-browser-mcp_*']).toBe(false);
  });

  it('experimental.chat.messages.transform chains caps, dedup, and nudge', async () => {
    const {
      nudgeHook,
      loopCommandManager,
      factories,
      capsInjector,
      toolOutputDeduper,
    } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const output = { messages: [{ info: { role: 'user' }, parts: [] }] };

    await hooks['experimental.chat.messages.transform']({}, output);

    expect(factories.createCapsMessagesInjector).toHaveBeenCalledWith(
      ctx.directory,
      ['browser', 'greper', 'executor', 'title'],
    );
    expect(factories.createToolOutputDeduper).toHaveBeenCalled();
    expect(capsInjector.handleMessagesTransform).toHaveBeenCalledWith(output);
    expect(toolOutputDeduper.handleMessagesTransform).toHaveBeenCalledWith(
      output,
    );
    expect(nudgeHook.handleMessagesTransform).toHaveBeenCalledWith({
      messages: output.messages,
    });
  });

  it('tool.execute.before sets _ui for editor/greper intents', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);

    const editorOutput = {
      args: {
        intents: [
          ['a', ['f1.ts']],
          ['b', ['f2.ts']],
        ],
      },
    };
    await hooks['tool.execute.before'](
      { tool: 'editor', sessionID: 's1', callID: 'c1' },
      editorOutput,
    );
    expect(editorOutput.args._ui).toBe('a; b');

    const greperOutput = { args: { intents: ['x'] } };
    await hooks['tool.execute.before'](
      { tool: 'greper', sessionID: 's1', callID: 'c2' },
      greperOutput,
    );
    expect(greperOutput.args._ui).toBe('x');

    const otherOutput = { args: { intents: ['y'] } };
    await hooks['tool.execute.before'](
      { tool: 'read', sessionID: 's1', callID: 'c3' },
      otherOutput,
    );
    expect(otherOutput.args._ui).toBeUndefined();
  });

  it('tool.execute.before rejects invalid _ui from LLM', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);

    await expect(
      hooks['tool.execute.before'](
        { tool: 'greper', sessionID: 's1', callID: 'c1' },
        { args: { intents: ['x'], _ui: { foo: 'bar' } as unknown as string } },
      ),
    ).rejects.toThrow('Invalid LLM input for greper: _ui must be a string');

    await expect(
      hooks['tool.execute.before'](
        { tool: 'editor', sessionID: 's1', callID: 'c2' },
        { args: { intents: ['a'], _ui: ['x'] as unknown as string } },
      ),
    ).rejects.toThrow('Invalid LLM input for editor: _ui must be a string');
  });

  it('tool.execute.before rejects non-string greper intents', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);

    await expect(
      hooks['tool.execute.before'](
        { tool: 'greper', sessionID: 's1', callID: 'c1' },
        { args: { intents: [{ foo: 'bar' }] as unknown as string[] } },
      ),
    ).rejects.toThrow(
      'Invalid LLM input for greper: intents must be an array of strings',
    );
  });

  it('tool.definition strips _ui from editor/greper parameters', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);

    const editorParams = {
      type: 'object',
      properties: {
        intents: { type: 'array' },
        _ui: { type: 'string' },
      },
      required: ['intents', '_ui'],
    };
    await hooks['tool.definition'](
      { toolID: 'editor' },
      { description: 'editor', parameters: editorParams },
    );
    expect(editorParams.properties).not.toHaveProperty('_ui');
    expect(editorParams.required).toEqual(['intents']);

    const greperParams = {
      type: 'object',
      properties: {
        intents: { type: 'array' },
        _ui: { type: 'string' },
      },
      required: ['intents', '_ui'],
    };
    await hooks['tool.definition'](
      { toolID: 'greper' },
      { description: 'greper', parameters: greperParams },
    );
    expect(greperParams.properties).not.toHaveProperty('_ui');
    expect(greperParams.required).toEqual(['intents']);
  });

  it('tool.execute.after chains syntax and nudge', async () => {
    const { nudgeHook, loopCommandManager, factories, syntaxCheckHook } =
      makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const input = { tool: 'editor', sessionID: 's1', callID: 'c1' };
    const output = { output: 'result' };

    await hooks['tool.execute.after'](input, output);

    expect(factories.createSyntaxCheckHook).toHaveBeenCalledWith(ctx);
    expect(syntaxCheckHook['tool.execute.after']).toHaveBeenCalledWith(
      input,
      output,
    );
    expect(nudgeHook.handleToolExecuteAfter).toHaveBeenCalledWith(
      input,
      output,
    );
  });

  it('command.execute.before chains loop and nudge', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const input = { command: 'foo', sessionID: 's1', arguments: 'bar' };
    const output = { parts: [] };

    await hooks['command.execute.before'](input, output);

    expect(loopCommandManager.handleCommandExecuteBefore).toHaveBeenCalledWith(
      input,
      output,
    );
    expect(nudgeHook.handleCommandExecuteBefore).toHaveBeenCalledWith(
      input,
      output,
    );
  });

  it('event forwards to nudge', async () => {
    const { nudgeHook, loopCommandManager, factories } = makeFakes();
    const hooks = createHooks(ctx, nudgeHook, loopCommandManager, factories);
    const input = { event: { type: 'test', properties: {} } };

    await hooks.event(input);

    expect(nudgeHook.handleEvent).toHaveBeenCalledWith(input);
  });
});
