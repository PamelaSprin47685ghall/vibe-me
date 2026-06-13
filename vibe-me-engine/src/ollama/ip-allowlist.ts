import { isIP } from 'node:net';

export const PRIVATE_IPV4_RANGES = [
  { start: 0x7F000000, end: 0x7FFFFFFF },
  { start: 0x0A000000, end: 0x0AFFFFFF },
  { start: 0xAC100000, end: 0xAC1FFFFF },
  { start: 0xC0A80000, end: 0xC0A8FFFF },
  { start: 0xA9FE0000, end: 0xA9FEFFFF },
  { start: 0x64400000, end: 0x647FFFFF },
  { start: 0x00000000, end: 0x00FFFFFF },
  { start: 0xE0000000, end: 0xFFFFFFFF },
];

export function ipv4ToUint32(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function isPrivateIPv4(ip: string): boolean {
  const addr = ipv4ToUint32(ip);
  return PRIVATE_IPV4_RANGES.some(r => addr >= r.start && addr <= r.end);
}

export function normalizeIPv6(ip: string): string {
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const v4part = lower.slice(7);
    if (isIP(v4part) === 4) return v4part;
  }
  return lower;
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = normalizeIPv6(ip);
  if (isIP(normalized) === 4) return isPrivateIPv4(normalized);
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  return false;
}

export function isIpBlocked(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export type SsrfResolutionResult =
  | { readonly kind: 'BlockedIp'; readonly ip: string; readonly reason: string }
  | { readonly kind: 'AllowlistedIp'; readonly ip: string };

export function BlockedIp(ip: string, reason: string): SsrfResolutionResult {
  return { kind: 'BlockedIp', ip, reason };
}

export function AllowlistedIp(ip: string): SsrfResolutionResult {
  return { kind: 'AllowlistedIp', ip };
}

export function checkIpAllowlist(ip: string): SsrfResolutionResult {
  if (isIpBlocked(ip)) return BlockedIp(ip, 'private or blocked IP range');
  return AllowlistedIp(ip);
}

export function validateHostname(hostname: string): boolean {
  const stripped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (stripped === 'localhost' || stripped === 'ip6-localhost' || stripped === 'ip6-loopback') return false;
  if (isIP(stripped)) return !isIpBlocked(stripped);
  return true;
}
