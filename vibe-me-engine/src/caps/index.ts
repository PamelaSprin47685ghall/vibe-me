import fs from 'node:fs/promises';
import path from 'node:path';

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const CAPS_DIR_RE = /^[A-Z][A-Z0-9_]*$/;
const EXCLUDED_FILE_NAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'README.md']);
const EXCLUDED_DIR_NAMES = new Set(['AGENTS', 'CLAUDE', 'NODE_MODULES', '.GIT', 'TARGET', 'DIST', 'OUT', '.VENV', 'VENV', '__PYCACHE__', '.CACHE', '.NEXT', '.TURBO', '.PARCEL-CACHE']);
const MAX_FILE_SIZE = 1_048_576;
const MAX_TOTAL_CONTEXT_BYTES = 8 * 1_048_576;
const MAX_CAPS_FILES = 200;
const MAX_DIR_DEPTH = 5;

export interface CapsFileInfo {
  filePath: string;
  label: string;
  content: string;
}

function isExcludedDir(name: string): boolean {
  const upper = name.toUpperCase();
  if (EXCLUDED_DIR_NAMES.has(upper)) return true;
  return name.startsWith('.') && !name.match(/^\.[A-Z][A-Z0-9_]*$/);
}

export async function findCapsFiles(projectRoot: string): Promise<CapsFileInfo[]> {
  const results: CapsFileInfo[] = [];
  let totalBytes = 0;
  let fileCount = 0;

  let rootEntries;
  try {
    rootEntries = await fs.readdir(projectRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of rootEntries) {
    const fullPath = path.join(projectRoot, entry.name);

    if (entry.isFile() && CAPS_FILE_RE.test(entry.name) && !EXCLUDED_FILE_NAMES.has(entry.name)) {
      if (fileCount >= MAX_CAPS_FILES || totalBytes >= MAX_TOTAL_CONTEXT_BYTES) break;
      const info = await tryReadFile(fullPath, entry.name);
      if (info) {
        if (totalBytes + info.content.length > MAX_TOTAL_CONTEXT_BYTES) break;
        totalBytes += info.content.length;
        fileCount += 1;
        results.push(info);
      }
    }

    if (entry.isDirectory() && CAPS_DIR_RE.test(entry.name) && !isExcludedDir(entry.name)) {
      const dirFiles: string[] = [];
      const visited = new Set<string>();
      await discoverFilesInDir(fullPath, dirFiles, 0, visited);
      for (const filePath of dirFiles) {
        if (fileCount >= MAX_CAPS_FILES || totalBytes >= MAX_TOTAL_CONTEXT_BYTES) break;
        const info = await tryReadFile(filePath, path.relative(projectRoot, filePath));
        if (info) {
          if (totalBytes + info.content.length > MAX_TOTAL_CONTEXT_BYTES) break;
          totalBytes += info.content.length;
          fileCount += 1;
          results.push(info);
        }
      }
    }
  }

  results.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return results;
}

async function tryReadFile(filePath: string, label: string): Promise<CapsFileInfo | undefined> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return undefined;
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.trim()) return undefined;
    return { filePath, label, content };
  } catch {
    return undefined;
  }
}

async function discoverFilesInDir(dirPath: string, out: string[], depth: number, visited: Set<string>): Promise<void> {
  if (depth >= MAX_DIR_DEPTH) return;
  
  let realPath: string;
  try {
    realPath = await fs.realpath(dirPath);
  } catch {
    return;
  }
  
  if (visited.has(realPath)) return;
  visited.add(realPath);
  
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile()) {
      out.push(fullPath);
    } else if (entry.isDirectory() && !isExcludedDir(entry.name)) {
      await discoverFilesInDir(fullPath, out, depth + 1, visited);
    }
  }
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

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const CAPS_INJECTION_SYMBOL = Symbol.for('engine.caps-injection');
const HOST_AGENTS_PROMPT_RE = /<dir-context>[\s\S]*?<\/dir-context>\n?/g;

function systemPromptHasInjection(systemPrompt: unknown): boolean {
  if (typeof systemPrompt === 'string') return systemPrompt.includes(CAPS_INJECTION_SYMBOL.description!);
  if (!Array.isArray(systemPrompt)) return false;
  return systemPrompt.some((item) => item && typeof item === 'object' && item[CAPS_INJECTION_SYMBOL] === true);
}

export function appendCapsContext(systemPrompt: unknown, rootDir: string): unknown {
  if (systemPromptHasInjection(systemPrompt)) return systemPrompt;
  const context = buildCapitalsContext(rootDir);
  if (!context) return systemPrompt;
  return [{ [CAPS_INJECTION_SYMBOL]: true, text: context }, ...(Array.isArray(systemPrompt) ? systemPrompt : [systemPrompt])];
}

export function stripHostAgentsPrompt(systemPrompt: unknown): unknown {
  if (typeof systemPrompt === 'string') return systemPrompt.replaceAll(HOST_AGENTS_PROMPT_RE, '');
  if (!Array.isArray(systemPrompt)) return systemPrompt;
  return systemPrompt.map((item) => (typeof item === 'string' ? item.replaceAll(HOST_AGENTS_PROMPT_RE, '') : item));
}

export interface CapitalsContextHook {
  handleSystemTransform: (input: { sessionID?: string }, output: { system: string[] }) => Promise<void>;
}

export function createCapsContextHook(projectRoot: string): CapitalsContextHook {
  let cachedPromise: Promise<string> | null = null;
  return {
    async handleSystemTransform(_input: { sessionID?: string }, output: { system: string[] }) {
      cachedPromise ??= buildCapitalsContext(projectRoot);
      const context = await cachedPromise;
      if (!context) return;
      const marker = '<caps-context';
      if (output.system.some((s) => typeof s === 'string' && s.includes(marker))) return;
      output.system.unshift(context);
    },
  };
}
