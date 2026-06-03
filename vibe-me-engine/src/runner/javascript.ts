import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { init, parse } from 'es-module-lexer';

let lexerInitPromise: Promise<void> | null = null;

function ensureLexer(): Promise<void> {
  lexerInitPromise ??= init;
  return lexerInitPromise;
}

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

export async function rewriteJavascriptModuleSpecifiers(program: string, cwd: string): Promise<string> {
  await ensureLexer();

  const [imports] = parse(program);
  if (imports.length === 0) return program;

  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const imp of imports) {
    if (imp.n && /^\.\.?\//.test(imp.n)) {
      const resolved = resolveJavascriptSpecifier(cwd, imp.n);
      // Dynamic imports (imp.d !== -1) include quotes in the span;
      // adjust to exclude them so they're preserved in the output.
      const startOff = imp.d !== -1 ? imp.s + 1 : imp.s;
      const endOff = imp.d !== -1 ? imp.e - 1 : imp.e;
      replacements.push({ start: startOff, end: endOff, replacement: resolved });
    }
  }

  if (replacements.length === 0) return program;

  replacements.sort((a, b) => b.start - a.start);

  let result = program;
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}
