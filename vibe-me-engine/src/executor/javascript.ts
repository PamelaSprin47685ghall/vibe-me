import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { init, parse } from 'es-module-lexer';

let lexerInitPromise: Promise<void> | null = null;

function ensureLexer(): Promise<void> {
  lexerInitPromise ??= init;
  return lexerInitPromise;
}

export async function ensureJavascriptProject(projectDir: string, dependencies: string[] | undefined): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(projectDir, { recursive: true });

  const pkgPath = `${projectDir}/package.json`;
  let pkgData: Record<string, unknown> = { type: 'module', dependencies: {} } as Record<string, unknown>;
  if (existsSync(pkgPath)) {
    try { pkgData = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch {}
  }
  if (!pkgData.dependencies) pkgData.dependencies = {};
  const deps = pkgData.dependencies as Record<string, string>;

  const requiredPackages = [...new Set(['tsx', ...(dependencies ?? [])])];
  const toInstall: string[] = [];
  for (const pkg of requiredPackages) {
    if (!deps[pkg]) toInstall.push(pkg);
  }
  if (toInstall.length === 0) return;

  for (const pkg of toInstall) deps[pkg] = '*';
  writeFileSync(pkgPath, `${JSON.stringify(pkgData, null, 2)}\n`, 'utf-8');

  const { spawn } = await import('node:child_process');
  await new Promise<void>((resolveInstall, rejectInstall) => {
    const child = spawn('npx', ['--yes', 'npm@latest', 'install', '--prefix', projectDir, ...toInstall], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    child.on('error', rejectInstall);
    child.on('close', (code) => code === 0 ? resolveInstall() : rejectInstall(new Error(`npm install exited with ${code}`)));
  });
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
