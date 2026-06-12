import { spawn } from 'node:child_process';
import { killTree, type ChildProcessLike as BaseChildProcessLike } from './process.js';
import { createTempScript, getTempScriptPath } from './script.js';
import { createJavascriptPrelude, rewriteJavascriptModuleSpecifiers, ensureJavascriptProject } from './javascript.js';
import type { ExecutorLanguage } from './types.js';

export interface InternalExecuteOptions {
  program: string;
  language: ExecutorLanguage;
  dependencies: string[] | undefined;
  cwd: string;
  projectDir: string | undefined;
  sessionId: string;
}

export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const systemClock: Clock = {
  setTimeout: (callback, ms) => global.setTimeout(callback, ms),
  clearTimeout: (id) => global.clearTimeout(id as NodeJS.Timeout),
};

export interface EventEmitterLike {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  removeAllListeners(event?: string): void;
}

export interface SpawnedChildProcessLike extends BaseChildProcessLike {
  stdout?: EventEmitterLike;
  stderr?: EventEmitterLike;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
}

export async function runExecutorProgramWithDeps(
  childProcess: SpawnedChildProcessLike,
  kill: (child: SpawnedChildProcessLike) => void,
  timeoutMs: number | undefined,
  clock: Clock,
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  let stdout = '';
  let stderr = '';
  childProcess.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  childProcess.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (code: number | null, timedOut: boolean) => {
      if (settled) return;
      settled = true;
      childProcess.stdout?.removeAllListeners();
      childProcess.stderr?.removeAllListeners();
      resolve({ stdout, stderr, code, timedOut });
    };

    const timer = timeoutMs === undefined ? null : clock.setTimeout(() => {
      kill(childProcess);
      settle(null, true);
    }, timeoutMs);

    childProcess.on('error', () => {
      if (timer !== null) clock.clearTimeout(timer);
      settle(null, false);
    });
    childProcess.on('close', (code) => {
      if (timer !== null) clock.clearTimeout(timer);
      settle(code, false);
    });
  });
}

export function spawnExecutorProgram(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs?: number,
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  const childProcess = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  return runExecutorProgramWithDeps(childProcess, killTree, timeoutMs, systemClock);
}

export async function executeShellProgram(options: InternalExecuteOptions, timeoutMs: number): ReturnType<typeof spawnExecutorProgram> {
  const extension = process.platform === 'win32' ? 'ps1' : 'sh';
  const scriptPath = createTempScript(getTempScriptPath(options.sessionId, extension), options.program);
  return spawnExecutorProgram(
    process.platform === 'win32' ? 'powershell.exe' : 'bash',
    process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass', '-File', scriptPath] : [scriptPath],
    options.cwd,
    timeoutMs,
  );
}

export async function executePythonProgram(options: InternalExecuteOptions, timeoutMs: number): ReturnType<typeof spawnExecutorProgram> {
  const scriptPath = createTempScript(getTempScriptPath(options.sessionId, 'py'), options.program);
  const baseArgs = ['--isolated'];
  for (const dep of options.dependencies ?? []) baseArgs.push('--with', dep);

  // Warm up uvx's dependency cache outside the execution timeout so that
  // package resolution/download time is not charged against the program run.
  if (options.dependencies?.length) {
    const warmup = await spawnExecutorProgram('uvx', [...baseArgs, '--from', 'python', 'python', '-c', 'pass'], options.cwd);
    if (warmup.code !== 0) return warmup;
  }

  return spawnExecutorProgram('uvx', [...baseArgs, '--from', 'python', 'python', scriptPath], options.cwd, timeoutMs);
}

export async function executeJavascriptProgram(options: InternalExecuteOptions, timeoutMs: number): ReturnType<typeof spawnExecutorProgram> {
  const projectDir = options.projectDir!;
  await ensureJavascriptProject(projectDir, options.dependencies);
  const scriptBody = `${createJavascriptPrelude(options.cwd)}${await rewriteJavascriptModuleSpecifiers(options.program, options.cwd)}`;
  const scriptPath = createTempScript(`${projectDir}/script.mts`, scriptBody);
  return spawnExecutorProgram(
    'npx',
    ['--prefix', projectDir, '--yes', '--no-install', 'tsx', scriptPath],
    options.cwd,
    timeoutMs,
  );
}

export async function runExecutorProgram(options: InternalExecuteOptions, timeoutMs: number): ReturnType<typeof spawnExecutorProgram> {
  if (options.language === 'shell') return executeShellProgram(options, timeoutMs);
  if (options.language === 'python') return executePythonProgram(options, timeoutMs);
  if (options.language === 'javascript') return executeJavascriptProgram(options, timeoutMs);
  throw new TypeError(`Unsupported executor language: ${options.language}`);
}
