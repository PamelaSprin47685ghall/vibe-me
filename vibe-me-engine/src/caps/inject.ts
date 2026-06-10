import { buildCapitalsContext } from './format.js';

export const CAPS_INJECTION_SYMBOL = Symbol.for('engine.caps-injection');
const HOST_AGENTS_PROMPT_RE = /<dir-context>[\s\S]*?<\/dir-context>\n?/g;

function systemPromptHasInjection(systemPrompt: unknown): boolean {
  if (typeof systemPrompt === 'string') return systemPrompt.includes(CAPS_INJECTION_SYMBOL.description!);
  if (!Array.isArray(systemPrompt)) return false;
  return systemPrompt.some((item) => item && typeof item === 'object' && item[CAPS_INJECTION_SYMBOL] === true);
}

export function appendCapsContext(systemPrompt: unknown, rootDir: string): unknown {
  if (systemPromptHasInjection(systemPrompt)) return systemPrompt;
  const context = buildCapitalsContext(rootDir);
  if (!context) return systemPrompt;
  return [{ [CAPS_INJECTION_SYMBOL]: true, text: context }, ...(Array.isArray(systemPrompt) ? systemPrompt : [systemPrompt])];
}

export function stripHostAgentsPrompt(systemPrompt: unknown): unknown {
  if (typeof systemPrompt === 'string') return systemPrompt.replaceAll(HOST_AGENTS_PROMPT_RE, '');
  if (!Array.isArray(systemPrompt)) return systemPrompt;
  return systemPrompt.map((item) => (typeof item === 'string' ? item.replaceAll(HOST_AGENTS_PROMPT_RE, '') : item));
}