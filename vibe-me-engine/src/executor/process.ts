import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export function killTree(childProcess: ChildProcess | null): void {
  const pid = childProcess?.pid;
  if (!pid) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      childProcess?.kill('SIGKILL');
    } catch {}
  }
}
