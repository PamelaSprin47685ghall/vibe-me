import { describe, expect, test } from 'vitest';
import { createCapsMessagesInjector, type FindCapsFiles } from './index.js';

function makeMessage(
  info: Record<string, unknown> = {},
  parts: Array<Record<string, unknown>> = [],
): {
  info: Record<string, unknown>;
  parts: Array<Record<string, unknown>>;
} {
  return {
    info: { id: 'msg-1', sessionID: 'sess-1', agent: 'orchestrator', ...info },
    parts,
  };
}

describe('createCapsMessagesInjector', () => {
  test('empty messages leaves output unchanged', async () => {
    const findCapsFiles: FindCapsFiles = async () => [
      { filePath: '/caps/a.md', content: 'hi' },
    ];
    const injector = createCapsMessagesInjector('/root', [], findCapsFiles);
    const output = { messages: [] };
    await injector.handleMessagesTransform(output);
    expect(output.messages).toEqual([]);
  });

  test('existing caps messages are replaced', async () => {
    const findCapsFiles: FindCapsFiles = async () => [
      { filePath: '/caps/a.md', content: 'new' },
    ];
    const injector = createCapsMessagesInjector('/root', [], findCapsFiles);
    const original = makeMessage();
    const output = {
      messages: [
        {
          info: { id: 'caps-synth-user-old', agent: 'orchestrator' },
          parts: [],
        },
        {
          info: { id: 'caps-synth-assistant-old', agent: 'orchestrator' },
          parts: [],
        },
        original,
      ],
    };
    await injector.handleMessagesTransform(output);
    expect(output.messages.length).toBe(3);
    expect(String(output.messages[0].info.id)).toMatch(/^caps-synth-user-/);
    expect(String(output.messages[1].info.id)).toMatch(
      /^caps-synth-assistant-/,
    );
    expect(output.messages[2]).toBe(original);
  });

  test('excluded agent skips injection', async () => {
    const findCapsFiles: FindCapsFiles = async () => [
      { filePath: '/caps/a.md', content: 'hi' },
    ];
    const injector = createCapsMessagesInjector(
      '/root',
      ['skipper'],
      findCapsFiles,
    );
    const output = { messages: [makeMessage({ agent: 'skipper' })] };
    await injector.handleMessagesTransform(output);
    expect(output.messages.length).toBe(1);
  });

  test('no caps files skips injection', async () => {
    const findCapsFiles: FindCapsFiles = async () => [];
    const injector = createCapsMessagesInjector('/root', [], findCapsFiles);
    const output = { messages: [makeMessage()] };
    await injector.handleMessagesTransform(output);
    expect(output.messages.length).toBe(1);
  });

  test('normal injection prepends user and assistant messages with tool parts', async () => {
    const capsFiles = [{ filePath: '/caps/a.md', content: 'hello\nworld' }];
    const findCapsFiles: FindCapsFiles = async () => capsFiles;
    const injector = createCapsMessagesInjector('/root', [], findCapsFiles);
    const original = makeMessage();
    const output = { messages: [original] };
    await injector.handleMessagesTransform(output);
    expect(output.messages.length).toBe(3);
    expect(output.messages[0].info.role).toBe('user');
    expect(output.messages[1].info.role).toBe('assistant');
    expect(output.messages[1].parts.length).toBe(1);

    const toolPart = output.messages[1].parts[0];
    expect(toolPart.type).toBe('tool');
    expect(toolPart.tool).toBe('read');
    expect(String(toolPart.state.output)).toContain('/caps/a.md');
    expect(String(toolPart.state.output)).toContain('hello');
    expect(output.messages[2]).toBe(original);
  });

  test('fingerprint is stable and derived from caps content', async () => {
    const capsFiles = [{ filePath: '/caps/x.md', content: 'content-a' }];
    const findCapsFiles: FindCapsFiles = async () => capsFiles;
    const injector = createCapsMessagesInjector('/root', [], findCapsFiles);
    const output1 = { messages: [makeMessage()] };
    const output2 = { messages: [makeMessage()] };
    await injector.handleMessagesTransform(output1);
    await injector.handleMessagesTransform(output2);
    expect(output1.messages[0].info.id).toBe(output2.messages[0].info.id);
    expect(output1.messages[1].info.id).toBe(output2.messages[1].info.id);

    const differentFindCapsFiles: FindCapsFiles = async () => [
      { ...capsFiles[0], content: 'content-b' },
    ];
    const differentInjector = createCapsMessagesInjector(
      '/root',
      [],
      differentFindCapsFiles,
    );
    const output3 = { messages: [makeMessage()] };
    await differentInjector.handleMessagesTransform(output3);
    expect(output3.messages[0].info.id).not.toBe(output1.messages[0].info.id);
  });
});
