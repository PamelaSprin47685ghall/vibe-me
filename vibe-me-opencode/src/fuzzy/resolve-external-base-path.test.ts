import { describe, expect, it } from 'bun:test';
import { resolveExternalBasePath, resolveExternalPath } from './index';

describe('resolveExternalBasePath', () => {
  it('treats path with extension as file → parent dir + filename', () => {
    const result = resolveExternalBasePath('/home/user/docs/readme.txt');
    expect(result.basePath).toBe('/home/user/docs');
    expect(result.pathConstraint).toBe('readme.txt');
  });

  it('treats path without extension as directory → self + null', () => {
    const result = resolveExternalBasePath('/home/user/project');
    expect(result.basePath).toBe('/home/user/project');
    expect(result.pathConstraint).toBeNull();
  });

  it('treats dot-prefixed path as file → parent dir + filename', () => {
    const result = resolveExternalBasePath('/home/user/.gitignore');
    expect(result.basePath).toBe('/home/user');
    expect(result.pathConstraint).toBe('.gitignore');
  });

  it('normalizes relative paths', () => {
    const result = resolveExternalBasePath('/tmp/../home/user/file.ts');
    expect(result.basePath).toBe('/home/user');
    expect(result.pathConstraint).toBe('file.ts');
  });
});

describe('resolveExternalPath', () => {
  const cwd = '/workspace/project';

  it('resolves external relative file paths', () => {
    expect(resolveExternalPath('../sibling/file.ts', cwd)).toEqual({
      externalBasePath: '/workspace/sibling',
      externalPathConstraint: 'file.ts',
    });
  });

  it('resolves external relative directories', () => {
    expect(resolveExternalPath('../sibling', cwd)).toEqual({
      externalBasePath: '/workspace/sibling',
      externalPathConstraint: null,
    });
  });

  it('keeps cwd-relative paths internal', () => {
    expect(resolveExternalPath('src/file.ts', cwd)).toEqual({
      externalBasePath: null,
      externalPathConstraint: null,
    });
  });
});
