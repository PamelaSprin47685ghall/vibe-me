import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as checkerModule from './checker';
import { createSyntaxCheckHook } from './index';
import { createMockCtx, createOutput } from './test-helpers';

describe('apply_patch tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'syntax-check-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it('appends syntax errors to apply_patch output', async () => {
    writeFileSync(join(tmpDir, 'one.ts'), 'const one = 1\n');
    writeFileSync(join(tmpDir, 'two.ts'), 'const two = 2\n');
    spyOn(checkerModule, 'checkSyntax')
      .mockResolvedValueOnce({
        ok: true,
        lang: 'typescript',
        errors: [
          {
            line: 1,
            column: 10,
            endLine: 1,
            endColumn: 11,
            severity: 'warning',
            message: 'first issue',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        lang: 'typescript',
        errors: [
          {
            line: 2,
            column: 1,
            endLine: 2,
            endColumn: 2,
            severity: 'warning',
            message: 'second issue',
          },
        ],
      });

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('patch applied');

    await hook['tool.execute.after'](
      {
        tool: 'apply_patch',
        sessionID: 's1',
        args: {
          patchText: [
            '*** Begin Patch',
            '*** Update File: one.ts',
            '@@',
            '-old',
            '+new',
            '*** Update File: two.ts',
            '@@',
            '-old',
            '+new',
            '*** End Patch',
          ].join('\n'),
        },
      },
      output,
    );

    expect(output.output).toContain('1 syntax issue(s) in one.ts');
    expect(output.output).toContain('first issue');
    expect(output.output).toContain('1 syntax issue(s) in two.ts');
    expect(output.output).toContain('second issue');
  });
});
