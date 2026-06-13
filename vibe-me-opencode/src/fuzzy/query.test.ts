import { describe, expect, it } from 'vitest';
import { buildQuery, normalizeExcludes, normalizePathConstraint } from 'engine/fuzzy';

describe('normalizePathConstraint', () => {
  it('returns null for empty path', () => {
    expect(normalizePathConstraint('')).toBeNull();
  });

  it('returns null for current directory', () => {
    expect(normalizePathConstraint('.')).toBeNull();
    expect(normalizePathConstraint('./')).toBeNull();
  });

  it('strips leading ./', () => {
    expect(normalizePathConstraint('./src')).toBe('src/');
  });

  it('adds trailing slash for bare directory', () => {
    expect(normalizePathConstraint('src/components')).toBe('src/components/');
  });

  it('keeps trailing slash', () => {
    expect(normalizePathConstraint('src/')).toBe('src/');
  });

  it('keeps glob patterns unchanged', () => {
    expect(normalizePathConstraint('*.ts')).toBe('*.ts');
    expect(normalizePathConstraint('src/**/*.ts')).toBe('src/**/*.ts');
  });

  it('returns null for external absolute paths', () => {
    expect(normalizePathConstraint('/outside/repo')).toBeNull();
  });

  it('normalizes absolute path inside cwd', () => {
    const cwd = '/home/user/project';
    expect(normalizePathConstraint('/home/user/project/src', cwd)).toBe('src/');
  });
});

describe('normalizeExcludes', () => {
  it('returns empty array for null/undefined', () => {
    expect(normalizeExcludes(null)).toEqual([]);
    expect(normalizeExcludes(undefined)).toEqual([]);
  });

  it('normalizes comma-separated excludes', () => {
    const result = normalizeExcludes('test/,*.min.js');
    expect(result).toContain('!test/');
    expect(result).toContain('!*.min.js');
  });

  it('preserves negation prefix from input', () => {
    const result = normalizeExcludes('!dist/');
    expect(result).toContain('!dist/');
  });
});

describe('buildQuery', () => {
  it('builds simple pattern query', () => {
    expect(buildQuery(null, 'main.ts', null)).toBe('main.ts');
  });

  it('builds query with path constraint', () => {
    const q = buildQuery('src', 'main.ts', null);
    expect(q).toContain('src/');
    expect(q).toContain('main.ts');
  });

  it('builds query with excludes', () => {
    const q = buildQuery(null, 'TODO', 'test/');
    expect(q).toContain('!test/');
    expect(q).toContain('TODO');
  });

  it('allows external absolute paths with allowExternal=true', () => {
    const q = buildQuery('/tmp/other', 'file.txt', null, '/home/proj', true);
    expect(q).toContain('/tmp/other');
  });
});
