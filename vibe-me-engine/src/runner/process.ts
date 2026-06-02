import { spawn } from 'node:child_process';

export function killTree(childProcess: import('node:child_process').ChildProcess | null): void {
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

export interface ChildProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export function runChildProcess(options: ChildProcessOptions): Promise<{ stdout: string; stderr: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ stdout: string; stderr: string }>();
  const childProcess = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  childProcess.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  childProcess.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

  const onAbort = () => killTree(childProcess);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  childProcess.on('error', (error) => {
    options.signal?.removeEventListener('abort', onAbort);
    reject(error);
  });
  childProcess.on('close', (code) => {
    options.signal?.removeEventListener('abort', onAbort);
    if (code === 0) {
      resolve({ stdout, stderr });
      return;
    }
    reject(new Error((`${stdout}${stderr}`).trim() || `${options.command} exited with code ${code}`));
  });
  return promise;
}
