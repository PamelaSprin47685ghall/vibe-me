import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyntaxError as SyntaxErrorInfo } from './checker';
import * as checkerModule from './checker';
import { createSyntaxCheckHook } from './index';
import { createMockCtx, createOutput } from './test-helpers';

function mockCheckSyntax(errors: SyntaxErrorInfo[]) {
  vi.spyOn(checkerModule, 'checkSyntax').mockResolvedValue({
    ok: true,
    lang: 'typescript',
    errors,
  });
}

describe('Write tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'syntax-check-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('appends syntax errors to Write tool output', async () => {
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1\n');
    mockCheckSyntax([
      {
        line: 1,
        column: 5,
        endLine: 1,
        endColumn: 6,
        severity: 'warning',
        message: 'Missing semicolon',
      },
    ]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('file written');

    await hook['tool.execute.after'](
      { tool: 'Write', sessionID: 's1', args: { path: 'test.ts' } },
      output,
    );

    expect(output.output).toContain('Missing semicolon');
  });

  it('recognizes filePath and file_path variants', async () => {
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1\n');
    mockCheckSyntax([
      {
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 2,
        severity: 'warning',
        message: 'test error',
      },
    ]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));

    const out1 = createOutput('written');
    await hook['tool.execute.after'](
      { tool: 'Write', sessionID: 's1', args: { filePath: 'test.ts' } },
      out1,
    );
    expect(out1.output).toContain('syntax issue(s)');

    const out2 = createOutput('written');
    await hook['tool.execute.after'](
      { tool: 'Write', sessionID: 's1', args: { file_path: 'test.ts' } },
      out2,
    );
    expect(out2.output).toContain('syntax issue(s)');
  });
});
