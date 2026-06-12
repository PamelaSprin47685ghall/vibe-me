import { spawn } from 'node:child_process';

export interface ChildProcessLike {
  pid?: number | undefined;
  kill?(signal?: NodeJS.Signals | number): boolean;
}

export function killTree(childProcess: ChildProcessLike | null): void {
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
      childProcess?.kill?.('SIGKILL');
    } catch {}
  }
}
