import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { killTree } from './process.js';
import { createTempScript, getTempScriptPath } from './script.js';
import { createJavascriptPrelude, rewriteJavascriptModuleSpecifiers, ensureJavascriptProject } from './javascript.js';
import type { RunnerLanguage } from './types.js';

export interface InternalExecuteOptions {
  program: string;
  language: RunnerLanguage;
  dependencies: string[] | undefined;
  cwd: string;
  projectDir: string | undefined;
  runner: {
    onSpawn: (child: ChildProcess) => void;
    abortSignal: AbortSignal;
    onOutput: (chunk: string) => void;
    onExit: (code: number | null) => void;
    onError: (message: string) => void;
  };
}

export async function spawnRunnerProgram(
  runner: InternalExecuteOptions['runner'],
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  const childProcess = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  runner.onSpawn(childProcess);
  childProcess.stdout?.on('data', (chunk: Buffer) => runner.onOutput(chunk.toString()));
  childProcess.stderr?.on('data', (chunk: Buffer) => runner.onOutput(chunk.toString()));

  const onAbort = () => killTree(childProcess);
  runner.abortSignal.addEventListener('abort', onAbort, { once: true });

  return new Promise<void>((resolve) => {
    childProcess.on('error', (error) => {
      runner.abortSignal.removeEventListener('abort', onAbort);
      childProcess.stdout?.removeAllListeners();
      childProcess.stderr?.removeAllListeners();
      runner.onError(error.message);
      resolve();
    });
    childProcess.on('close', (code) => {
      runner.abortSignal.removeEventListener('abort', onAbort);
      childProcess.stdout?.removeAllListeners();
      childProcess.stderr?.removeAllListeners();
      runner.onExit(code === null ? null : code);
      resolve();
    });
  });
}

export async function executeShellProgram(options: InternalExecuteOptions): Promise<void> {
  const extension = process.platform === 'win32' ? 'ps1' : 'sh';
  const scriptPath = createTempScript(getTempScriptPath(options.cwd, extension), options.program);
  return spawnRunnerProgram(
    options.runner,
    process.platform === 'win32' ? 'powershell.exe' : 'bash',
    process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass', '-File', scriptPath] : [scriptPath],
    options.cwd,
  );
}

export async function executePythonProgram(options: InternalExecuteOptions): Promise<void> {
  const scriptPath = createTempScript(getTempScriptPath(options.cwd, 'py'), options.program);
  const args = ['--isolated'];
  for (const dep of options.dependencies ?? []) args.push('--with', dep);
  args.push('--from', 'python', 'python', scriptPath);
  return spawnRunnerProgram(options.runner, 'uvx', args, options.cwd);
}

export async function executeJavascriptProgram(options: InternalExecuteOptions, projectDir: string): Promise<void> {
  await ensureJavascriptProject(projectDir, options.dependencies);
  const scriptBody = `${createJavascriptPrelude(options.cwd)}${await rewriteJavascriptModuleSpecifiers(options.program, options.cwd)}`;
  const scriptPath = createTempScript(`${projectDir}/script.mts`, scriptBody);
  return spawnRunnerProgram(
    options.runner,
    'npx',
    ['--prefix', projectDir, '--yes', '--no-install', 'tsx', scriptPath],
    options.cwd,
  );
}