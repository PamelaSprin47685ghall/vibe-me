import { createRequire } from 'node:module';

import hljs from 'highlight.js';
import type { SyntaxDiagnostic, SyntaxCheckResult } from '../util/types.js';

// @ts-ignore TS1343
const __require = createRequire(import.meta.url);

interface NativeNode {
  isError(): boolean;
  isMissing(): boolean;
  kind(): string;
  startPosition(): { row: number; column: number };
  endPosition(): { row: number; column: number };
  childCount(): number;
  child(index: number): NativeNode | undefined;
}

interface NativeTree {
  rootNode(): NativeNode;
}

interface NativeParser {
  setLanguage(lang: string): void;
  parse(source: string): NativeTree | undefined;
}

interface NativePack {
  detectLanguageFromPath(path: string): string | undefined;
  detectLanguageFromContent(content: string): string | undefined;
  hasLanguage(name: string): boolean;
  getParser(lang: string): NativeParser;
  downloadAll(): number;
}

function loadNativePack(): NativePack {
  const pkgPath = __require.resolve('@kreuzberg/tree-sitter-language-pack');
  const { platform, arch } = process;
  const suffix =
    platform === 'darwin' && arch === 'arm64' ? 'darwin-arm64' :
    platform === 'darwin' && arch === 'x64' ? 'darwin-x64' :
    platform === 'linux' && arch === 'x64' ? 'linux-x64-gnu' :
    platform === 'linux' && arch === 'arm64' ? 'linux-arm64-gnu' :
    platform === 'win32' && arch === 'x64' ? 'win32-x64-msvc' :
    platform === 'win32' && arch === 'arm64' ? 'win32-arm64-msvc' :
    null;
  if (!suffix) throw new Error(`Unsupported platform: ${platform}-${arch}`);
  const nativePath = __require.resolve(
    `@kreuzberg/tree-sitter-language-pack/ts-pack-core-node.${suffix}.node`,
  );
  return __require(nativePath) as NativePack;
}

let packPromise: Promise<NativePack> | null = null;

function getPack(): Promise<NativePack> {
  if (!packPromise) {
    packPromise = (async () => {
      const pack = loadNativePack();
      try { pack.downloadAll(); } catch {}
      return pack;
    })();
  }
  return packPromise;
}

function detectLangFromContentFallback(content: string, pack: NativePack): string | null {
  const result = hljs.highlightAuto(content);
  if (!result.language || result.relevance < 5) return null;
  return pack.hasLanguage(result.language) ? result.language : null;
}

function findErrorNodes(node: NativeNode): NativeNode[] {
  const out: NativeNode[] = [];
  const count = node.childCount();
  let hasInnerError = false;
  for (let i = 0; i < count; i += 1) {
    const child = node.child(i);
    if (child) {
      const childErrors = findErrorNodes(child);
      if (childErrors.length > 0) hasInnerError = true;
      out.push(...childErrors);
    }
  }
  if (node.isMissing() || (node.isError() && !hasInnerError)) {
    out.push(node);
  }
  return out;
}

export async function checkSyntax(content: string, filePath: string): Promise<SyntaxCheckResult> {
  let pack: NativePack;
  try {
    pack = await getPack();
  } catch {
    return { ok: true, lang: '', errors: [] };
  }

  let lang: string;
  try {
    lang = pack.detectLanguageFromPath(filePath)
      ?? pack.detectLanguageFromContent(content)
      ?? detectLangFromContentFallback(content, pack)
      ?? '';
  } catch {
    return { ok: true, lang: '', errors: [] };
  }
  if (!lang) return { ok: true, lang: '', errors: [] };

  let parser: NativeParser;
  try {
    parser = pack.getParser(lang);
  } catch {
    return { ok: true, lang, errors: [] };
  }

  try {
    const tree = parser.parse(content);
    if (!tree) return { ok: true, lang, errors: [] };

    const errors: SyntaxDiagnostic[] = findErrorNodes(tree.rootNode()).map((node) => {
      const start = node.startPosition();
      const end = node.endPosition();
      return {
        line: start.row + 1,
        column: start.column + 1,
        endLine: end.row + 1,
        endColumn: end.column + 1,
        severity: 'warning',
        message: node.isMissing() ? `Missing: ${node.kind()}` : node.kind(),
      };
    });

    return { ok: true, lang, errors };
  } catch {
    return { ok: true, lang, errors: [] };
  }
}
