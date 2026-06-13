import { describe, expect, it } from 'vitest';
import { killTree } from './process.js';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function once<T>(emitter: NodeJS.EventEmitter, event: string): Promise<T> {
  return new Promise(resolve => emitter.once(event, resolve));
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getChildPids(pid: number): Promise<number[]> {
  try {
    const content = await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
    return content.trim().split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

async function waitForChild(pid: number, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const children = await getChildPids(pid);
    if (children.length > 0) return children[0]!;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('timeout waiting for child');
}

describe('Process Tree Cleanup', () => {
  it('should kill process group using PGID', async () => {
    const childProcess = spawn(
      process.platform === 'win32' ? 'cmd' : 'bash',
      process.platform === 'win32'
        ? ['/c', 'pause']
        : ['-c', 'sleep 30'],
      {
        detached: process.platform !== 'win32',
        stdio: 'ignore',
      }
    );

    const parentPid = childProcess.pid;
    expect(parentPid).toBeGreaterThan(0);

    await once(childProcess, 'spawn');

    killTree(childProcess);

    await once(childProcess, 'exit');

    expect(await isProcessAlive(parentPid!)).toBe(false);
  }, 5000);

  it('should handle missing process gracefully', () => {
    expect(() => killTree(null)).not.toThrow();
  });

  it('should kill orphan grandchild process', async () => {
    const nodeScript = `
      const { spawn } = require('node:child_process');
      spawn('sleep', ['30'], { stdio: 'ignore' });
      setInterval(() => {}, 1000);
    `;

    const childProcess = spawn('node', ['-e', nodeScript], {
      detached: true,
      stdio: 'ignore',
    });

    const parentPid = childProcess.pid!;
    expect(parentPid).toBeGreaterThan(0);

    await once(childProcess, 'spawn');

    const grandchildPid = await waitForChild(parentPid, 2000);
    expect(grandchildPid).toBeGreaterThan(0);

    killTree(childProcess);

    await once(childProcess, 'exit');

    expect(await isProcessAlive(parentPid)).toBe(false);
    expect(await isProcessAlive(grandchildPid)).toBe(false);
  }, 5000);

  it('should handle already-dead process gracefully', async () => {
    const childProcess = spawn('sleep', ['0.01'], { stdio: 'ignore' });
    await once(childProcess, 'exit');
    expect(() => killTree(childProcess)).not.toThrow();
  });

  it('should tolerate concurrent killTree calls', async () => {
    const childProcess = spawn('sleep', ['30'], { stdio: 'ignore' });
    await once(childProcess, 'spawn');

    const parentPid = childProcess.pid!;
    expect(parentPid).toBeGreaterThan(0);

    await expect(
      Promise.all(Array.from({ length: 100 }, () => killTree(childProcess)))
    ).resolves.toEqual(Array.from({ length: 100 }).fill(undefined) as undefined[]);

    await once(childProcess, 'exit');
    expect(await isProcessAlive(parentPid)).toBe(false);
  }, 5000);
});
