import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import { ollamaPost } from './index.js';

const originalApiKey = process.env.OLLAMA_API_KEY;
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.OLLAMA_API_KEY = 'test-api-key';
  global.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.OLLAMA_API_KEY;
    return;
  }
  process.env.OLLAMA_API_KEY = originalApiKey;
});

describe('ollamaPost', () => {
  test('normalizes endpoint names without a leading slash', async () => {
    await ollamaPost('web_search', { query: 'mux web search' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      'https://ollama.com/api/web_search',
    );
  });

  test('preserves endpoint names with a leading slash', async () => {
    await ollamaPost('/web_fetch', { url: 'https://example.com' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      'https://ollama.com/api/web_fetch',
    );
  });
});
