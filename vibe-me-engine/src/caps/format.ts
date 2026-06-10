import { findCapsFiles } from './discover.js';

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function buildCapitalsContext(projectRoot: string): Promise<string> {
  const files = await findCapsFiles(projectRoot);
  if (files.length === 0) return '';
  const parts: string[] = [];
  for (const file of files) {
    parts.push(`<caps-context file="${escapeXmlAttr(file.label)}">\n${file.content}\n</caps-context>`);
  }
  return parts.join('\n\n');
}