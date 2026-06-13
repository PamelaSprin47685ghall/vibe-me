import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { resolveFuzzySearchPath } from './query.js';

const rootPath = path.parse(process.cwd()).root;
const workspacePath = path.join(rootPath, 'workspace');
const cwd = path.join(workspacePath, 'project');

describe('resolveFuzzySearchPath', () => {
  it('keeps relative paths inside cwd non-external', () => {
    expect(resolveFuzzySearchPath('src', cwd)).toEqual({
      basePath: cwd,
      pathConstraint: 'src',
      external: false,
    });
  });

  it('normalizes relative paths that resolve inside cwd', () => {
    expect(resolveFuzzySearchPath('../project/src', cwd)).toEqual({
      basePath: cwd,
      pathConstraint: 'src',
      external: false,
    });
  });

  it('treats relative paths outside cwd as external', () => {
    expect(resolveFuzzySearchPath('../sibling', cwd)).toEqual({
      basePath: path.join(workspacePath, 'sibling'),
      pathConstraint: null,
      external: true,
    });
  });

  it('preserves absolute path external behavior', () => {
    const absoluteFilePath = path.join(cwd, 'src', 'index.ts');

    expect(resolveFuzzySearchPath(absoluteFilePath, cwd)).toEqual({
      basePath: path.dirname(absoluteFilePath),
      pathConstraint: 'index.ts',
      external: true,
    });
  });
});
