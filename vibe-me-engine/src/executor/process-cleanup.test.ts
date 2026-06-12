import { describe, expect, it } from 'bun:test';
import { killTree } from './process.js';
import { spawn } from 'node:child_process';

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
});
