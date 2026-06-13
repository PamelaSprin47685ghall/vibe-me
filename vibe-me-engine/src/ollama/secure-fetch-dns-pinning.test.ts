import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { isIpBlocked, validateHostname, secureFetch } from './secure-fetch-dns-pinning.js';

let resolve4Result: string[] = [];
let resolve6Result: string[] = [];

mock.module('node:dns/promises', () => ({
  resolve4: mock(async () => resolve4Result),
  resolve6: mock(async () => resolve6Result),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = mock(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
  resolve4Result = [];
  resolve6Result = [];
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('isIpBlocked', () => {
  test.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])('blocks private IPv4 %s', (ip) => {
    expect(isIpBlocked(ip)).toBe(true);
  });

  test('allows public IPv4 8.8.8.8', () => {
    expect(isIpBlocked('8.8.8.8')).toBe(false);
  });

  test.each(['::1', '::', 'fe80::1', 'fc00::1', 'fd00::1'])('blocks private IPv6 %s', (ip) => {
    expect(isIpBlocked(ip)).toBe(true);
  });

  test('allows public IPv6 2001:4860:4860::8888', () => {
    expect(isIpBlocked('2001:4860:4860::8888')).toBe(false);
  });

  test.each(['::ffff:127.0.0.1', '::ffff:192.168.1.1'])('blocks IPv4-mapped %s', (ip) => {
    expect(isIpBlocked(ip)).toBe(true);
  });
});

describe('validateHostname', () => {
  test.each(['localhost', 'LOCALHOST', '[::1]', 'ip6-localhost', 'ip6-loopback'])('rejects %s', (hostname) => {
    expect(validateHostname(hostname)).toBe(false);
  });

  test.each([
    'example.com',
    'ollama.com',
    'api.example.com',
    '8.8.8.8',
    '2001:4860:4860::8888',
    '[2001:4860:4860::8888]',
  ])('allows %s', (hostname) => {
    expect(validateHostname(hostname)).toBe(true);
  });

  test('rejects direct blocked IPs', () => {
    expect(validateHostname('127.0.0.1')).toBe(false);
    expect(validateHostname('192.168.1.1')).toBe(false);
    expect(validateHostname('::1')).toBe(false);
  });
});

describe('secureFetch', () => {
  test('rejects blocked resolved IPv4', async () => {
    resolve4Result = ['127.0.0.1'];

    await expect(secureFetch('http://evil.example.com/')).rejects.toThrow('SSRF protection');
  });

  test('rejects blocked resolved IPv6', async () => {
    resolve6Result = ['::1'];

    await expect(secureFetch('http://evil.example.com/')).rejects.toThrow('SSRF protection');
  });

  test('accepts public resolved IPv4', async () => {
    resolve4Result = ['8.8.8.8'];

    await secureFetch('http://public.example.com/');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('accepts public resolved IPv6', async () => {
    resolve6Result = ['2001:4860:4860::8888'];

    await secureFetch('http://public.example.com/');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('rejects direct blocked IP URLs', async () => {
    await expect(secureFetch('http://127.0.0.1/')).rejects.toThrow('SSRF protection');
    await expect(secureFetch('http://192.168.1.1/')).rejects.toThrow('SSRF protection');
  });

  test('rejects IPv4-mapped blocked resolved IPs', async () => {
    resolve6Result = ['::ffff:192.168.1.1'];

    await expect(secureFetch('http://evil.example.com/')).rejects.toThrow('SSRF protection');
  });

  test('DNS rebinding: private resolution is rejected even after public resolution', async () => {
    resolve4Result = ['8.8.8.8'];

    await secureFetch('http://rebound.example.com/');

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolve4Result = ['127.0.0.1'];

    await expect(secureFetch('http://rebound.example.com/')).rejects.toThrow('SSRF protection');
  });
});
