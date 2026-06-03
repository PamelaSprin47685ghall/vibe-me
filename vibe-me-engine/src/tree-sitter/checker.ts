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

async function loadTreeSitterPack(): Promise<WasmPack> {
  const mod = await import('@kreuzberg/tree-sitter-language-pack-wasm');
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
