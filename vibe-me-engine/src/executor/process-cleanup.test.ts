import { describe, expect, it } from 'bun:test';
import { killTree } from './process.js';
import { spawn } from 'node:child_process';

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
        ? ['/c', 'timeout /t 30 >nul']
        : ['-c', 'sleep 30'],
      {
        detached: process.platform !== 'win32',
        stdio: 'ignore',
      }
    );

    const parentPid = childProcess.pid;
    expect(parentPid).toBeGreaterThan(0);

    await new Promise(resolve => setTimeout(resolve, 200));

    killTree(childProcess);

    await new Promise(resolve => setTimeout(resolve, 500));

    const parentAlive = await isProcessAlive(parentPid!);
    expect(parentAlive).toBe(false);
  }, 5000);

  it('should handle missing process gracefully', () => {
    expect(() => killTree(null)).not.toThrow();
  });
});
