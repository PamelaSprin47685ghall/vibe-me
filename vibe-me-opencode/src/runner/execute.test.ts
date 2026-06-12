import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  abort,
  cleanupJob,
  createJobRegistry,
  type ExecuteResult,
  execute,
  getActiveJobs,
} from 'engine/runner';

const jobs = createJobRegistry();

const hasNpx = (() => {
  try {
    execFileSync('npx', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const itIfNpx = hasNpx ? it : it.skip;

describe('execute', () => {
  beforeEach(() => {
    for (const [sessionId] of getActiveJobs(jobs)) {
      cleanupJob(jobs, sessionId);
    }
  });

  afterEach(() => {
    for (const [sessionId] of getActiveJobs(jobs)) {
      cleanupJob(jobs, sessionId);
    }
  });

  it('should execute fast shell command and return synchronously', async () => {
    const result: ExecuteResult = await execute({
      jobs,
      sessionId: 'test-fast-shell',
      program: 'echo "hello"',
      language: 'shell',
    });

    expect(result.background).toBe(false);
    expect(result.output).toContain('hello');
  });

  it('should execute fast Python code and return synchronously', async () => {
    const result: ExecuteResult = await execute({
      jobs,
      sessionId: 'test-fast-python',
      program: 'print("hello from python")',
      language: 'python',
    });

    expect(result.background).toBe(false);
    expect(result.output).toContain('hello from python');
  });

  itIfNpx(
    'should background slow JavaScript code (no real-time wait)',
    async () => {
      const result: ExecuteResult = await execute({
        jobs,
        sessionId: 'test-bg-js',
        program: 'setInterval(() => {}, 60000);',
        language: 'javascript',
        earlyTimeoutMs: 50,
      });

      expect(result.background).toBe(true);
      expect(result.jobId).toBe('test-bg-js');
      abort(jobs, 'test-bg-js');
    },
  );

  itIfNpx(
    'should background JavaScript with CJS require prelude (no real-time wait)',
    async () => {
      const result: ExecuteResult = await execute({
        jobs,
        sessionId: 'test-bg-js-require',
        program: [
          'const path = require("node:path");',
          'console.log("basename=" + path.basename("/tmp/foo.txt"));',
        ].join('\n'),
        language: 'javascript',
        earlyTimeoutMs: 50,
      });

      expect(result.background).toBe(true);
      abort(jobs, 'test-bg-js-require');
    },
  );

  itIfNpx(
    'should background JavaScript with rewritten relative imports (no real-time wait)',
    async () => {
      const tmpDir = join(
        tmpdir(),
        `oc-kunwei-runner-fixture-${randomUUID()}`,
      );
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(
        join(tmpDir, 'fixture-relimport.mjs'),
        'export const value = 42;\n',
      );
      try {
        const result: ExecuteResult = await execute({
          jobs,
          sessionId: 'test-bg-js-relimport',
          program: [
            'import { value } from "./fixture-relimport.mjs";',
            'console.log("got=" + value);',
          ].join('\n'),
          language: 'javascript',
          earlyTimeoutMs: 50,
          cwd: tmpDir,
        });
        expect(result.background).toBe(true);
        abort(jobs, 'test-bg-js-relimport');
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  );

  it('should background slow commands', async () => {
    const result: ExecuteResult = await execute({
      jobs,
      sessionId: 'test-slow',
      program: 'sleep 10',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    expect(result.background).toBe(true);
    expect(result.jobId).toBe('test-slow');
  });

  it('should block duplicate execution', async () => {
    await execute({
      jobs,
      sessionId: 'test-duplicate',
      program: 'sleep 10',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    try {
      await execute({
        jobs,
        sessionId: 'test-duplicate',
        program: 'echo "should fail"',
        language: 'shell',
        earlyTimeoutMs: 50,
      });
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain('A task is already running');
    }
  });


});
