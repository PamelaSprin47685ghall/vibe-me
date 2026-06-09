import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PluginInput } from '@opencode-ai/plugin';

import * as checkerModule from './checker';
import { createSyntaxCheckHook } from './index';
import { checkSyntax } from './checker';

function mockCheckSyntax(errors: checkerModule.SyntaxError[]) {
  spyOn(checkerModule, 'checkSyntax').mockResolvedValue({
    ok: true,
    lang: 'typescript',
    errors,
  });
}

function createMockCtx(directory: string): PluginInput {
  return {
    directory,
    worktree: directory,
    client: {} as PluginInput['client'],
    project: {} as PluginInput['project'],
    serverUrl: new URL('http://localhost:3000'),
    $: {} as PluginInput['$'],
  };
}

function createOutput(output: string) {
  return { title: 'edit', output, metadata: {} };
}

describe('createSyntaxCheckHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'syntax-check-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it('appends syntax errors to edit tool output', async () => {
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1\n');
    mockCheckSyntax([
      {
        line: 5,
        column: 1,
        endLine: 5,
        endColumn: 2,
        severity: 'warning',
        message: "Expected ')'",
      },
    ]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited successfully');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'test.ts' } },
      output,
    );

    expect(output.output).toContain('1 syntax issue(s) in test.ts');
    expect(output.output).toContain("L5:1-5:2 [warning] Expected ')'");
    expect(output.output).toContain('[syntax-check]');
  });

  it('appends syntax check failures to edit tool output', async () => {
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1\n');
    spyOn(checkerModule, 'checkSyntax').mockResolvedValue({
      ok: false,
      lang: 'typescript',
      errors: [],
      reason: 'parser returned undefined',
    });

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited successfully');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'test.ts' } },
      output,
    );

    expect(output.output).toContain('[syntax-check]');
    expect(output.output).toContain(
      'Syntax check failed in test.ts (typescript): parser returned undefined',
    );
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

  it('appends syntax errors to apply_patch output', async () => {
    writeFileSync(join(tmpDir, 'one.ts'), 'const one = 1\n');
    writeFileSync(join(tmpDir, 'two.ts'), 'const two = 2\n');
    spyOn(checkerModule, 'checkSyntax')
      .mockResolvedValueOnce({
        ok: true,
        lang: 'typescript',
        errors: [{
          line: 1,
          column: 10,
          endLine: 1,
          endColumn: 11,
          severity: 'warning',
          message: 'first issue',
        }],
      })
      .mockResolvedValueOnce({
        ok: true,
        lang: 'typescript',
        errors: [{
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 2,
          severity: 'warning',
          message: 'second issue',
        }],
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

  it('skips when there are no syntax errors', async () => {
    writeFileSync(join(tmpDir, 'test.ts'), 'const x = 1\n');
    mockCheckSyntax([]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited successfully');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'test.ts' } },
      output,
    );

    expect(output.output).toBe('edited successfully');
  });

  it('skips when checkSyntax returns empty errors (e.g. unsupported language)', async () => {
    writeFileSync(join(tmpDir, 'binary.bin'), '\x00\x01\x02');
    spyOn(checkerModule, 'checkSyntax').mockResolvedValue({
      ok: true,
      lang: '',
      errors: [],
    });

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited successfully');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'binary.bin' } },
      output,
    );

    expect(output.output).toBe('edited successfully');
  });

  it('ignores non-file-edit tools', async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('ok');

    await hook['tool.execute.after'](
      { tool: 'bash', sessionID: 's1', args: {} },
      output,
    );

    expect(output.output).toBe('ok');
  });

  it('ignores non-string output', async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = { title: 'edit', output: { success: true }, metadata: {} };

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'test.ts' } },
      output as any,
    );

    expect(output.output).toEqual({ success: true });
  });

  it('skips when args has no file path', async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: {} },
      output,
    );

    expect(output.output).toBe('edited');
  });

  it('skips when file is unreadable', async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput('edited');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'nonexistent.ts' } },
      output,
    );

    expect(output.output).toBe('edited');
  });

  it('does not duplicate syntax check if marker already present', async () => {
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
    const output = createOutput('edited\n[syntax-check]\nalready here');

    await hook['tool.execute.after'](
      { tool: 'edit', sessionID: 's1', args: { path: 'test.ts' } },
      output,
    );

    // Should not append again
    expect(output.output).toBe('edited\n[syntax-check]\nalready here');
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

    // filePath variant
    const out1 = createOutput('written');
    await hook['tool.execute.after'](
      { tool: 'Write', sessionID: 's1', args: { filePath: 'test.ts' } },
      out1,
    );
    expect(out1.output).toContain('syntax issue(s)');

    // file_path variant
    const out2 = createOutput('written');
    await hook['tool.execute.after'](
      { tool: 'Write', sessionID: 's1', args: { file_path: 'test.ts' } },
      out2,
    );
    expect(out2.output).toContain('syntax issue(s)');
  });
});

describe('checkSyntax return paths', () => {
  it('always returns ok:true even for unsupported language', async () => {
    const result = await checkSyntax('content', '/tmp/file.unknown_ext');
    expect(result.ok).toBe(true);
  });

  it('returns ok:true with empty errors for valid typescript', async () => {
    const result = await checkSyntax('const x: number = 1;\n', '/tmp/test.ts');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
      expect(result.lang).toBeTruthy();
    }
  });

  it('detects python from content when file has no extension', async () => {
    const pyCode = 'import os\nimport sys\n\ndef main():\n    print("Hello, World!")\n    for i in range(10):\n        if i % 2 == 0:\n            print(i)\n\nif __name__ == "__main__":\n    main()\n';
    const result = await checkSyntax(pyCode, '/tmp/script');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.lang).toBe('python');
  });

  it('detects javascript from content when file has no extension', async () => {
    const jsCode = 'const { useState, useEffect } = require("react");\n\nmodule.exports = function App() {\n  const [count, setCount] = useState(0);\n  return count;\n};\n';
    const result = await checkSyntax(jsCode, '/tmp/myfile');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.lang).toBe('javascript');
  });
});
