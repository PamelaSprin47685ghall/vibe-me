import type { SyntaxDiagnostic, SyntaxCheckResult } from '../util/types.js';

interface WasmNode {
  isError(): boolean;
  isMissing(): boolean;
  kind(): string;
  startPosition(): { row: number; column: number };
  endPosition(): { row: number; column: number };
  childCount(): number;
  child(index: number): WasmNode | null;
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

interface ShimMemory {
  buffer: ArrayBuffer;
}

const shimMemory: ShimMemory = { buffer: new ArrayBuffer(0) };

function memU8(): Uint8Array {
  return new Uint8Array(shimMemory.buffer);
}

function buildEnvMock() {
  return {
    strcmp(a: number, b: number): number {
      const u8 = memU8();
      let i = 0;
      while (true) {
        const ca = u8[a + i];
        const cb = u8[b + i];
        const caVal = ca ?? 0;
        const cbVal = cb ?? 0;
        if (caVal !== cbVal) return caVal - cbVal;
        if (caVal === 0) return 0;
        i += 1;
      }
    },
    memchr(ptr: number, value: number, num: number): number {
      const u8 = memU8();
      const target = value & 0xff;
      for (let i = 0; i < num; i += 1) {
        if (u8[ptr + i] === target) return ptr + i;
      }
      return 0;
    },
    iswlower(wc: number): number {
      try {
        const c = String.fromCodePoint(wc);
        return c === c.toLowerCase() && c !== c.toUpperCase() ? 1 : 0;
      } catch { return 0; }
    },
    iswupper(wc: number): number {
      try {
        const c = String.fromCodePoint(wc);
        return c === c.toUpperCase() && c !== c.toLowerCase() ? 1 : 0;
      } catch { return 0; }
    },
    iswxdigit(wc: number): number {
      return (wc >= 48 && wc <= 57) || (wc >= 97 && wc <= 102) || (wc >= 65 && wc <= 70) ? 1 : 0;
    },
    towlower(wc: number): number {
      try {
        return String.fromCodePoint(wc).toLowerCase().codePointAt(0) ?? wc;
      } catch { return wc; }
    },
  };
}

let packPromise: Promise<WasmPack> | null = null;

async function loadPack(): Promise<WasmPack> {
  const { createRequire } = await import('node:module');
  const Module = createRequire(import.meta.url)('node:module') as {
    prototype: { require: (id: string) => unknown };
  };
  const originalRequire = Module.prototype.require;
  const originalInstance = WebAssembly.Instance;
  const envMock = buildEnvMock();

  Module.prototype.require = function patchedRequire(id: string) {
    if (id === 'env') return envMock;
    return originalRequire.call(this, id);
  };

  WebAssembly.Instance = function patchedInstance(
    module: WebAssembly.Module,
    importObject?: WebAssembly.Imports,
  ) {
    const instance = new originalInstance(module, importObject);
    const memory = (instance.exports as { memory?: WebAssembly.Memory }).memory;
    const hasEnv = importObject && (importObject as Record<string, unknown>).env != null;
    if (memory && hasEnv) shimMemory.buffer = memory.buffer;
    return instance;
  } as unknown as typeof WebAssembly.Instance;

  try {
    return (await import('@kreuzberg/tree-sitter-language-pack-wasm')) as unknown as WasmPack;
  } finally {
    Module.prototype.require = originalRequire;
    WebAssembly.Instance = originalInstance;
  }
}

function getPack(): Promise<WasmPack> {
  packPromise ??= loadPack();
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
