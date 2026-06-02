export { isIpBlocked, secureFetch } from './secure-fetch-dns-pinning.js';
export { validateHostname } from './secure-fetch-dns-pinning.js';

export function isPrivateIPv4(ip: string): boolean {
  return ipIsBlocked(ip);
}

export function isPrivateIPv6(ip: string): boolean {
  return ipIsBlocked(ip);
}

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
  return validateHost(parsed.hostname);
}

export const OLLAMA_API_BASE = 'https://ollama.com/api';

export function getOllamaApiKey(): string {
  return process.env.OLLAMA_API_KEY ?? '';
}

export async function ollamaPost(pathname: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(`${OLLAMA_API_BASE}${pathname}`, {
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

export function formatSearchResults(results: Array<{ title: string; url: string; content: string }>): string {
  if (!results?.length) return 'No results found.';
  return results.map((item, i) => `${i + 1}. ${item.title}\n   URL: ${item.url}\n   ${item.content}`).join('\n\n');
}

export function formatFetchResponse(data: { title?: string; byline?: string; length?: number; content?: string }): string {
  return [
    `Title: ${data.title ?? ''}`,
    data.byline ? `By: ${data.byline}` : null,
    typeof data.length === 'number' ? `Length: ${data.length}` : null,
    '',
    data.content ?? '',
  ].filter(Boolean).join('\n');
}
