export const HOT_FRECENCY = 25;
export const WARM_FRECENCY = 20;
const GREP_MAX_LINE_LENGTH = 500;

export interface FileAnnotationItem {
  gitStatus?: string;
  totalFrecencyScore?: number;
  accessFrecencyScore?: number;
}

export function truncateLine(line: string, max = GREP_MAX_LINE_LENGTH): string {
  const trimmed = line.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}...`;
}

export function fileAnnotation(item: FileAnnotationItem | null | undefined): string {
  try {
    const git = item?.gitStatus;
    if (git && git !== 'clean' && git !== 'unknown' && git !== '') {
      return `  [${git} in git]`;
    }
    const frecency = item?.totalFrecencyScore ?? item?.accessFrecencyScore ?? 0;
    if (frecency >= HOT_FRECENCY) return '  [VERY often touched file]';
    if (frecency >= WARM_FRECENCY) return '  [often touched file]';
  } catch {
    // best effort
  }
  return '';
}

export interface GrepMatch {
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
  gitStatus?: string;
  totalFrecencyScore?: number;
  accessFrecencyScore?: number;
}

export interface GrepResultLike {
  items?: GrepMatch[] | null;
  totalMatched?: number;
  nextCursor?: unknown;
  regexFallbackError?: string;
}

export function formatGrepOutput(result: GrepResultLike | null | undefined): string {
  try {
    const items = result?.items ?? [];
    if (items.length === 0) return 'No matches found';
    const totalMatched = result?.totalMatched ?? items.length;
    const lines: string[] = [`${totalMatched} match${totalMatched === 1 ? '' : 'es'}`, ''];
    let currentFile = '';
    for (const match of items) {
      if (!match) continue;
      if (match.relativePath !== currentFile) {
        if (currentFile) lines.push('');
        currentFile = match.relativePath;
        lines.push(`${currentFile}${fileAnnotation(match)}`);
      }
      const ctxBefore = match.contextBefore ?? [];
      const ctxAfter = match.contextAfter ?? [];
      const ctxLen = ctxBefore.length;
      for (let i = 0; i < ctxLen; i += 1) {
        const lineNum = match.lineNumber - ctxLen + i;
        const line = ctxBefore[i];
        if (line !== undefined) lines.push(` ${lineNum}- ${truncateLine(line)}`);
      }
      lines.push(` ${match.lineNumber}: ${truncateLine(match.lineContent)}`);
      for (let i = 0; i < ctxAfter.length; i += 1) {
        const lineNum = match.lineNumber + 1 + i;
        const line = ctxAfter[i];
        if (line !== undefined) lines.push(` ${lineNum}- ${truncateLine(line)}`);
      }
    }
    return lines.join('\n');
  } catch {
    return '(error formatting grep output)';
  }
}

export interface FindMatch {
  relativePath: string;
  gitStatus?: string;
  totalFrecencyScore?: number;
  accessFrecencyScore?: number;
}

export interface FindResultLike {
  items?: FindMatch[] | null;
  totalMatched?: number;
  totalFiles?: number;
}

export function formatFindOutput(result: FindResultLike | null | undefined): string {
  try {
    const items = result?.items ?? [];
    if (items.length === 0) return 'No matching files found';
    const totalMatched = result?.totalMatched ?? items.length;
    const totalFiles = result?.totalFiles ?? 0;
    const lines: string[] = [
      `${totalMatched} matching file${totalMatched === 1 ? '' : 's'} (${totalFiles} total indexed)`,
      '',
    ];
    for (const item of items) {
      if (!item) continue;
      lines.push(`${item.relativePath}${fileAnnotation(item)}`);
    }
    return lines.join('\n');
  } catch {
    return '(error formatting find output)';
  }
}
