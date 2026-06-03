import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

import type { SyntaxDiagnostic, SyntaxCheckResult } from '../util/types.js';

interface WasmNode {
  isError(): boolean;
  isMissing(): boolean;
  kind(): string;
  startPosition(): { row: number; column: number };
  endPosition(): { row: number; column: number };
  childCount(): number;
  child(index: number): WasmNode | undefined;
}

interface WasmTree {
  rootNode(): WasmNode;
}

interface WasmParser {
  setLanguage(lang: string): void;
  parse(source: string): WasmTree | undefined;
}

interface WasmPack {
  detectLanguageFromPath(path: string): string | undefined;
  getParser(lang: string): WasmParser;
}

const __require = createRequire(import.meta.url);

const ENV_SHIM = `{
  iswlower: function(c) { return c >= 97 && c <= 122 ? 1 : 0; },
  iswupper: function(c) { return c >= 65 && c <= 90 ? 1 : 0; },
  iswxdigit: function(c) { return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102) ? 1 : 0; },
  towlower: function(c) { return c >= 65 && c <= 90 ? c + 32 : c; },
  strcmp: function(a, b) {
    var mem = new Uint8Array(wasm.memory.buffer);
    for (var i = 0;; i++) {
      var ca = mem[a + i], cb = mem[b + i];
      if (ca !== cb) return ca < cb ? -1 : 1;
      if (ca === 0) return 0;
    }
  },
  memchr: function(ptr, c, n) {
    var mem = new Uint8Array(wasm.memory.buffer);
    for (var i = 0; i < n; i++) { if (mem[ptr + i] === c) return ptr + i; }
    return 0;
  },
  memcpy: function(dest, src, num) {
    var mem = new Uint8Array(wasm.memory.buffer);
    mem.copyWithin(dest, src, src + num);
    return dest;
  },
  memmove: function(dest, src, num) {
    var mem = new Uint8Array(wasm.memory.buffer);
    var tmp = mem.slice(src, src + num);
    mem.set(tmp, dest);
    return dest;
  },
  memset: function(ptr, value, num) {
    var mem = new Uint8Array(wasm.memory.buffer);
    mem.fill(value & 0xff, ptr, ptr + num);
    return ptr;
  },
  strlen: function(ptr) {
    var mem = new Uint8Array(wasm.memory.buffer);
    var len = 0;
    while (mem[ptr + len] !== 0) len++;
    return len;
  },
  emscripten_notify_memory_growth: function(_index) {},
  __indirect_function_table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
}`;

async function loadTreeSitterPack(): Promise<WasmPack> {
  const wasmPath = __require.resolve('@kreuzberg/tree-sitter-language-pack-wasm');
  const patchedPath = wasmPath.replace('.js', '.patched.js');

  if (!existsSync(patchedPath)) {
    const source = readFileSync(wasmPath, 'utf-8');
    const patched = source.replace(/require\("env"\)/g, () => ENV_SHIM);
    writeFileSync(patchedPath, patched);
  }

  const mod = __require(patchedPath);
  return {
    detectLanguageFromPath: (path: string) => mod.detectLanguageFromPath(path),
    getParser: (lang: string) => mod.getParser(lang),
  };
}

let packPromise: Promise<WasmPack> | null = null;

function getPack(): Promise<WasmPack> {
  packPromise ??= loadTreeSitterPack();
  return packPromise;
}

function findErrorNodes(node: WasmNode): WasmNode[] {
  const out: WasmNode[] = [];
  if (node.isError() || node.isMissing()) {
    out.push(node);
    return out;
  }
  const count = node.childCount();
  for (let i = 0; i < count; i += 1) {
    const child = node.child(i);
    if (child) out.push(...findErrorNodes(child));
  }
  return out;
}

export async function checkSyntax(content: string, filePath: string): Promise<SyntaxCheckResult> {
  let pack: WasmPack;
  try {
    pack = await getPack();
  } catch (err) {
    return { ok: false, reason: `failed to load wasm pack: ${err instanceof Error ? err.message : String(err)}` };
  }

  const lang = pack.detectLanguageFromPath(filePath);
  if (!lang) return { ok: false, reason: `unsupported language: ${filePath}` };

  const parser = pack.getParser(lang);
  try {
    parser.setLanguage(lang);
  } catch (err) {
    return { ok: false, reason: `setLanguage failed for ${lang}: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const tree = parser.parse(content);
    if (!tree) return { ok: false, reason: 'parser returned undefined tree' };

    const errors: SyntaxDiagnostic[] = findErrorNodes(tree.rootNode()).map((node) => {
      const start = node.startPosition();
      const end = node.endPosition();
      return {
        line: start.row + 1,
        column: start.column + 1,
        endLine: end.row + 1,
        endColumn: end.column + 1,
        severity: 'error',
        message: node.isMissing() ? `Missing: ${node.kind()}` : node.kind(),
      };
    });

    return { ok: true, lang, errors };
  } catch (err) {
    return { ok: false, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
