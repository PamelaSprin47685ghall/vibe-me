import { describe, expect, it } from 'bun:test';
import { posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createJavascriptPrelude,
  resolveJavascriptSpecifier,
  rewriteJavascriptModuleSpecifiers,
} from 'engine/runner';

describe('createJavascriptPrelude', () => {
  it('emits a CJS require bridge, __dirname, __filename, and ends with a newline', () => {
    const cwd = '/tmp/example';
    const prelude = createJavascriptPrelude(cwd);
    expect(prelude).toContain('import { createRequire } from "node:module";');
    expect(prelude).toContain('const require = createRequire(');
    expect(prelude).toContain(`const __dirname = ${JSON.stringify(cwd)};`);
    expect(prelude).toContain(
      `const __filename = ${JSON.stringify(`${cwd}/__runner__.mjs`)};`,
    );
    expect(prelude.endsWith('\n')).toBe(true);
  });
});

describe('resolveJavascriptSpecifier', () => {
  it('resolves ./relative to a file:// URL using posix separators on POSIX', () => {
    const cwd = '/home/me/project';
    const result = resolveJavascriptSpecifier(cwd, './lib/util.js');
    if (process.platform !== 'win32') {
      const expected = pathToFileURL('/home/me/project/lib/util.js').href;
      expect(result).toBe(expected);
    } else {
      expect(result.startsWith('file:///')).toBe(true);
      expect(result).toContain('lib');
      expect(result).toContain('util.js');
    }
  });

  it('resolves ../relative to a file:// URL', () => {
    const cwd = '/home/me/project/sub';
    const result = resolveJavascriptSpecifier(cwd, '../sibling.mjs');
    if (process.platform !== 'win32') {
      const expected = pathToFileURL('/home/me/project/sibling.mjs').href;
      expect(result).toBe(expected);
    } else {
      expect(result.startsWith('file:///')).toBe(true);
      expect(result).toContain('sibling.mjs');
    }
  });

  it('preserves query strings and hash fragments', () => {
    const cwd = '/home/me/project';
    const result = resolveJavascriptSpecifier(cwd, './mod.mjs?t=1#frag');
    if (process.platform !== 'win32') {
      expect(result).toBe(
        `${pathToFileURL('/home/me/project/mod.mjs').href}?t=1#frag`,
      );
    } else {
      expect(result).toContain('mod.mjs');
      expect(result).toContain('?t=1#frag');
    }
  });

  it('leaves bare specifiers (no ./ or ../) untouched', () => {
    const cwd = '/home/me/project';
    expect(resolveJavascriptSpecifier(cwd, 'node:fs')).toBe('node:fs');
    expect(resolveJavascriptSpecifier(cwd, 'lodash')).toBe('lodash');
  });
});

describe('rewriteJavascriptModuleSpecifiers', () => {
  it('rewrites `from "./x"` to a file:// import', async () => {
    const cwd = '/home/me/project';
    const out = await rewriteJavascriptModuleSpecifiers(
      'import { foo } from "./foo.mjs";\n',
      cwd,
    );
    const fileHref = pathToFileURL('/home/me/project/foo.mjs').href;
    expect(out).toContain(`from "${fileHref}";`);
  });

  it('rewrites `export * from "../x"` to a file:// export', async () => {
    const cwd = '/home/me/project/nested';
    const out = await rewriteJavascriptModuleSpecifiers(
      'export * from "../sibling.mjs";\n',
      cwd,
    );
    const fileHref = pathToFileURL('/home/me/project/sibling.mjs').href;
    expect(out).toContain(`from "${fileHref}";`);
  });

  it('rewrites dynamic import("./x") to a file:// URL', async () => {
    const cwd = '/home/me/project';
    const out = await rewriteJavascriptModuleSpecifiers(
      'const m = await import("./mod.mjs");\n',
      cwd,
    );
    const fileHref = pathToFileURL('/home/me/project/mod.mjs').href;
    expect(out).toContain(`import("${fileHref}")`);
  });

  it('does not rewrite bare specifiers (e.g. node:fs, lodash)', async () => {
    const cwd = '/home/me/project';
    const src = [
      'import fs from "node:fs";',
      'import lodash from "lodash";',
    ].join('\n');
    const out = await rewriteJavascriptModuleSpecifiers(src, cwd);
    expect(out).toContain('import fs from "node:fs";');
    expect(out).toContain('import lodash from "lodash";');
  });

  it('does not rewrite non-string specifiers or unrelated `from` tokens', async () => {
    const cwd = '/home/me/project';
    const out = await rewriteJavascriptModuleSpecifiers(
      'const from = "literal";\nconst x = from;\n',
      cwd,
    );
    expect(out).toBe('const from = "literal";\nconst x = from;\n');
  });

  it('round-trips: rewritten pathToFileURL/fileURLToPath matches a real file', async () => {
    const cwd = '/home/me/project';
    const out = await rewriteJavascriptModuleSpecifiers(
      'import x from "./module.mjs";',
      cwd,
    );
    const match = /from "(file:\/\/[^"]+)"/.exec(out);
    expect(match).not.toBeNull();
    const path = fileURLToPath(match?.[1] as string);
    if (process.platform !== 'win32') {
      expect(path).toBe(posix.join('/home/me/project', 'module.mjs'));
    } else {
      expect(path.replace(/\\/g, '/')).toBe('/home/me/project/module.mjs');
    }
  });
});
