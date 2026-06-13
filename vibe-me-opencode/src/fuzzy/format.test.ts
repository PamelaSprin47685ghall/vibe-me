import { describe, expect, it } from 'vitest';
import { formatFindOutput, formatGrepOutput } from 'engine/fuzzy';

describe('formatGrepOutput', () => {
  it('returns no matches message for empty result', () => {
    expect(formatGrepOutput({ items: [], totalMatched: 0 })).toBe(
      'No matches found',
    );
  });

  it('formats grep matches grouped by file', () => {
    const result = {
      items: [
        {
          relativePath: 'src/index.ts',
          fileName: 'index.ts',
          gitStatus: 'clean',
          size: 100,
          modified: 1000,
          isBinary: false,
          totalFrecencyScore: 0,
          accessFrecencyScore: 0,
          modificationFrecencyScore: 0,
          lineNumber: 10,
          col: 0,
          byteOffset: 0,
          lineContent: '  const x = 1;',
          matchRanges: [[8, 9] as [number, number]],
          contextBefore: [],
          contextAfter: ['const y = 2;'],
        },
        {
          relativePath: 'src/index.ts',
          fileName: 'index.ts',
          gitStatus: 'clean',
          size: 100,
          modified: 1000,
          isBinary: false,
          totalFrecencyScore: 0,
          accessFrecencyScore: 0,
          modificationFrecencyScore: 0,
          lineNumber: 12,
          col: 0,
          byteOffset: 0,
          lineContent: 'useEffect(() => {});',
          matchRanges: [[0, 9] as [number, number]],
          contextBefore: [],
          contextAfter: [],
        },
      ],
      totalMatched: 2,
    };

    const output = formatGrepOutput(result);
    expect(output).toContain('2 matches');
    expect(output).toContain('src/index.ts');
    expect(output).toContain('10:');
    expect(output).toContain('const x = 1;');
    expect(output).toContain('11-');
    expect(output).toContain('const y = 2;');
  });
});

describe('formatFindOutput', () => {
  it('returns no files message for empty result', () => {
    const result = formatFindOutput({ items: [], totalFiles: 0, totalMatched: 0 });
    expect(result).toBe('No matching files found');
  });

  it('formats file paths with total count', () => {
    const result = formatFindOutput(
      {
        items: [
          {
            relativePath: 'src/main.ts',
            fileName: 'main.ts',
            size: 500,
            modified: 1000,
            accessFrecencyScore: 0,
            modificationFrecencyScore: 0,
            totalFrecencyScore: 10,
            gitStatus: 'clean',
          },
        ],
        totalFiles: 20,
        totalMatched: 1,
      },
    );
    expect(result).toContain('1 matching file (20 total indexed)');
    expect(result).toContain('src/main.ts');
  });

  it('formats multiple matches without score heuristics', () => {
    const result = formatFindOutput(
      {
        items: [
          {
            relativePath: 'src/unrelated.ts',
            fileName: 'unrelated.ts',
            size: 200,
            modified: 1000,
            accessFrecencyScore: 0,
            modificationFrecencyScore: 0,
            totalFrecencyScore: 0,
            gitStatus: 'clean',
          },
        ],
        totalFiles: 250,
        totalMatched: 10,
      },
    );
    expect(result).toContain('10 matching files (250 total indexed)');
    expect(result).toContain('src/unrelated.ts');
  });
});
