import { createRequire } from 'node:module';

import hljs from 'highlight.js';
import { err, ok, type Result } from '../types/general.js';
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return 'unknown error';
}

function syntaxCheckFailed(lang: string, reason: string): SyntaxCheckResult {
  return { ok: false, lang, reason };
}

async function loadNativePack(): Promise<Result<NativePack, string>> {
  const { platform, arch } = process;
  const suffix =
    platform === 'darwin' && arch === 'arm64' ? 'darwin-arm64' :
    platform === 'darwin' && arch === 'x64' ? 'darwin-x64' :
    platform === 'linux' && arch === 'x64' ? 'linux-x64-gnu' :
    platform === 'linux' && arch === 'arm64' ? 'linux-arm64-gnu' :
    platform === 'win32' && arch === 'x64' ? 'win32-x64-msvc' :
    platform === 'win32' && arch === 'arm64' ? 'win32-arm64-msvc' :
    null;
  if (!suffix) return err(`Unsupported platform: ${platform}-${arch}`);
  try {
    const nativePath = __require.resolve(
      `@kreuzberg/tree-sitter-language-pack/ts-pack-core-node.${suffix}.node`,
    );
    return ok(__require(nativePath) as NativePack);
  } catch (error) {
    return err(errorMessage(error));
  }
}

const packPromise: Promise<Result<NativePack, string>> = loadNativePack().then((result) => {
  if (result._tag === 'Err') return result;
  try { result.value.downloadAll(); } catch {}
  return result;
});

function getPack(): Promise<Result<NativePack, string>> {
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
  const packResult = await getPack();
  if (packResult._tag === 'Err') {
    return syntaxCheckFailed('', `native language pack load failed: ${packResult.error}`);
  }
  const pack = packResult.value;

  let lang: string;
  try {
    lang = pack.detectLanguageFromPath(filePath)
      ?? pack.detectLanguageFromContent(content)
      ?? detectLangFromContentFallback(content, pack)
      ?? '';
  } catch (error) {
    return syntaxCheckFailed('', `language detection failed: ${errorMessage(error)}`);
  }
  if (!lang) return { ok: true, lang: '', errors: [] };

  let parser: NativeParser;
  try {
    parser = pack.getParser(lang);
  } catch (error) {
    return syntaxCheckFailed(lang, `parser load failed: ${errorMessage(error)}`);
  }

  try {
    const tree = parser.parse(content);
    if (!tree) return syntaxCheckFailed(lang, 'parser returned undefined');

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
  } catch (error) {
    return syntaxCheckFailed(lang, `parse failed: ${errorMessage(error)}`);
  }
}
