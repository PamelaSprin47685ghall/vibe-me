import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_IPV4_RANGES = [
  { start: 0x7F000000, end: 0x7FFFFFFF },     // 127.0.0.0/8
  { start: 0x0A000000, end: 0x0AFFFFFF },     // 10.0.0.0/8
  { start: 0xAC100000, end: 0xAC1FFFFF },     // 172.16.0.0/12
  { start: 0xC0A80000, end: 0xC0A8FFFF },     // 192.168.0.0/16
  { start: 0xA9FE0000, end: 0xA9FEFFFF },     // 169.254.0.0/16
  { start: 0x64400000, end: 0x647FFFFF },     // 100.64.0.0/10
  { start: 0x00000000, end: 0x00FFFFFF },     // 0.0.0.0/8
  { start: 0xE0000000, end: 0xFFFFFFFF },     // 224.0.0.0/4 + 240.0.0.0/4
];

function ipv4ToUint32(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const addr = ipv4ToUint32(ip);
  return PRIVATE_IPV4_RANGES.some(r => addr >= r.start && addr <= r.end);
}

function normalizeIPv6(ip: string): string {
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const v4part = lower.slice(7);
    if (isIP(v4part) === 4) return v4part;
  }
  return lower;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = normalizeIPv6(ip);
  
  if (isIP(normalized) === 4) return isPrivateIPv4(normalized);
  
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || 
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  
  return false;
}

export function isIpBlocked(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

interface DnsPinnedResult {
  ip: string;
  family: 4 | 6;
}

async function resolveDnsPinned(hostname: string): Promise<DnsPinnedResult> {
  if (isIP(hostname)) {
    if (isIpBlocked(hostname)) {
      throw new Error(`SSRF protection: direct IP ${hostname} is blocked`);
    }
    return { ip: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let addresses: string[] = [];
  
  try {
    const ipv4 = await resolve4(hostname);
    addresses.push(...ipv4);
  } catch {}

  try {
    const ipv6 = await resolve6(hostname);
    addresses.push(...ipv6);
  } catch {}

  if (addresses.length === 0) {
    throw new Error(`DNS resolution failed for ${hostname}`);
  }

  for (const addr of addresses) {
    if (isIpBlocked(addr)) {
      throw new Error(`SSRF protection: resolved IP ${addr} for ${hostname} is blocked`);
    }
  }

  const selectedIp = addresses[0]!;
  return { ip: selectedIp, family: isIP(selectedIp) as 4 | 6 };
}

function createDnsPinningAgent<T extends typeof HttpAgent | typeof HttpsAgent>(
  BaseAgent: T,
  isHttps: boolean,
) {
  return class DnsPinningAgent extends BaseAgent {
    createConnection = (options: any, callback?: any) => {
      const hostname = options?.host || 'localhost';
      resolveDnsPinned(hostname)
        .then(({ ip }) => {
          const pinnedOptions = isHttps
            ? { ...options, host: ip, servername: options?.servername || hostname }
            : { ...options, host: ip };
          if (callback) super.createConnection(pinnedOptions, callback);
        })
        .catch((err: Error) => callback?.(err));
      return undefined;
    };
  };
}

const DnsPinningHttpAgent = createDnsPinningAgent(HttpAgent, false);
const DnsPinningHttpsAgent = createDnsPinningAgent(HttpsAgent, true);

const dnsPinningHttpAgent = new DnsPinningHttpAgent({ keepAlive: true });
const dnsPinningHttpsAgent = new DnsPinningHttpsAgent({ keepAlive: true, rejectUnauthorized: false });

export function validateHostname(hostname: string): boolean {
  const stripped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (stripped === 'localhost' || stripped === 'ip6-localhost' || stripped === 'ip6-loopback') return false;
  if (isIP(stripped)) return !isIpBlocked(stripped);
  return true;
}

export async function secureFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  
  await resolveDnsPinned(parsedUrl.hostname);
  
  return fetch(url, {
    ...init,
    // @ts-expect-error - Node.js fetch accepts agent
    agent: isHttps ? dnsPinningHttpsAgent : dnsPinningHttpAgent,
  });
}
