import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

export function createJavascriptPrelude(cwd: string): string {
  return [
    'import { createRequire } from "node:module";',
    `const require = createRequire(${JSON.stringify(join(cwd, '__runner__.cjs'))});`,
    `const __dirname = ${JSON.stringify(cwd)};`,
    `const __filename = ${JSON.stringify(join(cwd, '__runner__.mjs'))};`,
    '',
  ].join('\n');
}

export function resolveJavascriptSpecifier(cwd: string, specifier: string): string {
  const match = /^(\.{1,2}(?:\/[^?#]*)?)([?#].*)?$/.exec(specifier);
  if (!match) return specifier;
  return `${pathToFileURL(resolve(cwd, match[1]!)).href}${match[2] || ''}`;
}

export function rewriteJavascriptModuleSpecifiers(program: string, cwd: string): string {
  return program
    .replace(/\b(from\s*['"])(\.{1,2}\/[^'"]*)(['"])/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveJavascriptSpecifier(cwd, specifier)}${suffix}`)
    .replace(/\b(export\s+\*\s+from\s*['"])(\.{1,2}\/[^'"]*)(['"])/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveJavascriptSpecifier(cwd, specifier)}${suffix}`)
    .replace(/\b(import\s*\(\s*['"])(\.{1,2}\/[^'"]*)(['"]\s*\))/g, (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveJavascriptSpecifier(cwd, specifier)}${suffix}`);
}
