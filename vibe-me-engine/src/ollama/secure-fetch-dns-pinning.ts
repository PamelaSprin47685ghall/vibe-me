import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isIpBlocked, validateHostname, checkIpAllowlist } from './ip-allowlist.js';

interface DnsPinnedResult {
  ip: string;
  family: 4 | 6;
}

async function resolveDnsPinned(hostname: string): Promise<DnsPinnedResult> {
  if (isIP(hostname)) {
    const result = checkIpAllowlist(hostname);
    if (result.kind === 'BlockedIp') {
      throw new Error(`SSRF protection: direct IP ${result.ip} is blocked`);
    }
    return { ip: result.ip, family: isIP(hostname) as 4 | 6 };
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
    const result = checkIpAllowlist(addr);
    if (result.kind === 'BlockedIp') {
      throw new Error(`SSRF protection: resolved IP ${result.ip} for ${hostname} is blocked`);
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

export { isIpBlocked, validateHostname };

interface RequestInitWithAgent extends RequestInit {
  agent?: HttpAgent | HttpsAgent;
}

export async function secureFetch(url: string, init?: RequestInitWithAgent): Promise<Response> {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';

  await resolveDnsPinned(parsedUrl.hostname);

  return fetch(url, {
    ...init,
    // @ts-expect-error
    agent: isHttps ? dnsPinningHttpsAgent : dnsPinningHttpAgent,
  });
}
