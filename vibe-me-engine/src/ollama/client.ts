import { validateHostname, secureFetch } from './secure-fetch-dns-pinning.js';

export async function validateFetchUrl(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `unsupported URL scheme: ${parsed.protocol}`;
  }
  return validateHostname(parsed.hostname) ? null : 'host not allowed';
}

export const OLLAMA_API_BASE = 'https://ollama.com/api';

export function getOllamaApiKey(): string {
  return process.env.OLLAMA_API_KEY ?? '';
}

function normalizeOllamaPath(pathname: string): string {
  // Mux passes bare endpoint names, while other callers include the leading slash.
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export async function ollamaPost(pathname: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await secureFetch(`${OLLAMA_API_BASE}${normalizeOllamaPath(pathname)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getOllamaApiKey()}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama API error (${response.status}): ${text || response.statusText}`);
  }
  return await response.json() as Record<string, unknown>;
}