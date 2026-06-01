import { lookup } from 'node:dns/promises';
import net from 'node:net';

const LOOPBACK_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback']);

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && (parts[1] ?? 0) >= 64 && (parts[1] ?? 0) <= 127) return true;
  if (parts[0]! >= 224) return true;
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.slice(7));
  return false;
}

export function ipIsBlocked(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export function validateHostname(hostname: string): string | null {
  const stripped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(stripped)) return 'localhost fetch is not allowed';
  if (net.isIP(stripped)) return ipIsBlocked(stripped) ? 'private network fetch is not allowed' : null;
  return null;
}

export async function resolveAndValidate(hostname: string): Promise<string | null> {
  const staticError = validateHostname(hostname);
  if (staticError) return staticError;
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return 'hostname could not be resolved';
  }
  if (!addresses.length) return 'hostname resolved to no addresses';
  for (const { address } of addresses) {
    if (ipIsBlocked(address)) return 'private network fetch is not allowed';
  }
  return null;
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
  return resolveAndValidate(parsed.hostname);
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
