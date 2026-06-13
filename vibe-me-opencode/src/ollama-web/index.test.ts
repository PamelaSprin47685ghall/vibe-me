import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createOllamaWebFetchTool,
  createOllamaWebSearchTool,
  executeOllamaFetch,
  executeOllamaSearch,
  formatOllamaWebError,
} from './index';

vi.mock('./key', () => ({
  OLLAMA_API_KEY: process.env.OLLAMA_API_KEY ?? '',
}));

const originalApiKey = process.env.OLLAMA_API_KEY;

beforeEach(() => {
  process.env.OLLAMA_API_KEY = 'test-api-key';
});

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OLLAMA_API_KEY;
  } else {
    process.env.OLLAMA_API_KEY = originalApiKey;
  }
});

describe('executeOllamaFetch', () => {
  test('rejects invalid URL', async () => {
    const result = await executeOllamaFetch(
      { url: 'not-a-url' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toBe('invalid URL');
    }
  });

  test('rejects unsupported protocol', async () => {
    const result = await executeOllamaFetch(
      { url: 'file:///etc/passwd' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toBe(
        'unsupported URL scheme: file:',
      );
    }
  });

  test('rejects ftp protocol', async () => {
    const result = await executeOllamaFetch(
      { url: 'ftp://example.com/file' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toBe(
        'unsupported URL scheme: ftp:',
      );
    }
  });

  test('accepts valid https URL and calls API', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            title: 'Test',
            content: '<p>hello</p>',
            byline: '',
            length: 100,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    ) as any;

    const result = await executeOllamaFetch(
      { url: 'https://example.com/doc' },
      { abort: new AbortController().signal },
    );

    expect(result._tag).toBe('Ok');
    if (result._tag === 'Ok') {
      expect(result.value).toContain('Title: Test');
      expect(result.value).toContain('hello');
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callUrl = (global.fetch as any).mock.calls[0][0];
    expect(callUrl).toContain('/web_fetch');
  });

  test('accepts valid http URL', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            title: 'HTTP',
            content: 'ok',
            byline: '',
            length: 50,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    ) as any;

    const result = await executeOllamaFetch(
      { url: 'http://example.com/page' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Ok');
    if (result._tag === 'Ok') {
      expect(result.value).toContain('Title: HTTP');
    }
  });

  test('handles API error response', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }),
    ) as any;

    const result = await executeOllamaFetch(
      { url: 'https://example.com/error' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toContain(
        'Ollama API error (502)',
      );
    }
  });

  test('handles aborted request', async () => {
    const controller = new AbortController();
    global.fetch = vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }) as any;

    const result = await executeOllamaFetch(
      { url: 'https://example.com/slow' },
      { abort: controller.signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toBe('Request was cancelled');
    }
  });
});

describe('executeOllamaSearch', () => {
  test('sends query to API and returns results', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              { title: 'Result 1', url: 'https://example.com/1' },
              { title: 'Result 2', url: 'https://example.com/2' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ) as any;

    const result = await executeOllamaSearch(
      { query: 'test search', numResults: 5 },
      { abort: new AbortController().signal },
    );

    expect(result._tag).toBe('Ok');
    if (result._tag === 'Ok') {
      expect(result.value).toContain('Result 1');
      expect(result.value).toContain('Result 2');
      expect(result.value).toContain('https://example.com/1');
    }
  });

  test('handles API error', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response('Unauthorized', {
          status: 401,
          statusText: 'Unauthorized',
        }),
    ) as any;

    const result = await executeOllamaSearch(
      { query: 'test' },
      { abort: new AbortController().signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toContain(
        'Ollama API error (401)',
      );
    }
  });

  test('handles abort', async () => {
    const controller = new AbortController();
    global.fetch = vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }) as any;

    const result = await executeOllamaSearch(
      { query: 'test' },
      { abort: controller.signal },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(formatOllamaWebError(result.error)).toBe('Request was cancelled');
    }
  });
});

describe('createOllamaWebFetchTool', () => {
  test('unwraps result to string', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            title: 'Test',
            content: '<p>hello</p>',
            byline: '',
            length: 100,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    ) as any;

    const tool = createOllamaWebFetchTool();
    const result = await (tool as any).execute(
      { url: 'https://example.com/doc' },
      { abort: new AbortController().signal },
    );
    expect(result).toContain('Title: Test');
  });
});

describe('createOllamaWebSearchTool', () => {
  test('unwraps result to string', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [{ title: 'Result 1', url: 'https://example.com/1' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ) as any;

    const tool = createOllamaWebSearchTool();
    const result = await (tool as any).execute(
      { query: 'test' },
      { abort: new AbortController().signal },
    );
    expect(result).toContain('Result 1');
  });
});
