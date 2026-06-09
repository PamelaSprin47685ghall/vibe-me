import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { getRunnerLogPath, getRunnerProjectDir, RUNNER_EARLY_TIMEOUT_MS } from './paths.js';
import { killTree } from './process.js';
import { stripHeadTailPipes } from './no-head-tail.js';
import { createJavascriptPrelude, rewriteJavascriptModuleSpecifiers } from './javascript.js';
import { runChildProcess } from './process.js';
import { ActiveJob, cleanupRegistry, createTempScript, getTempScriptPath, globalJobRegistry, MAX_OUTPUT_BYTES } from './job.js';
import type { ExecuteOptions, ExecuteResult, WaitOptions, WaitResult, RunnerLanguage } from './types.js';

function truncateTail(text: string, max: number): string {
  return text.length <= max ? text : text.slice(-max);
}

export function getActiveJobs(): Map<string, ActiveJob> {
  return globalJobRegistry;
}

export function cleanupJob(sessionId: string): void {
  cleanupRegistry(globalJobRegistry, sessionId);
}

export async function ensureJavascriptProject(projectDir: string, dependencies: string[] | undefined): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(projectDir, { recursive: true });

  const pkgPath = `${projectDir}/package.json`;
  let pkgData: Record<string, unknown> = { type: 'module', dependencies: {} } as Record<string, unknown>;
  if (existsSync(pkgPath)) {
    try { pkgData = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch {}
  }
  if (!pkgData.dependencies) pkgData.dependencies = {};
  const deps = pkgData.dependencies as Record<string, string>;

  const requiredPackages = [...new Set(['tsx', ...(dependencies ?? [])])];
  const toInstall: string[] = [];
  for (const pkg of requiredPackages) {
    if (!deps[pkg]) toInstall.push(pkg);
  }
  if (toInstall.length === 0) return;

  for (const pkg of toInstall) deps[pkg] = '*';
  writeFileSync(pkgPath, `${JSON.stringify(pkgData, null, 2)}\n`, 'utf-8');

  await runChildProcess({
    command: 'npx',
    args: ['--yes', 'npm@latest', 'install', '--prefix', projectDir, ...toInstall],
    cwd: projectDir,
  });
}

interface InternalExecuteOptions {
  program: string;
  language: RunnerLanguage;
  dependencies: string[] | undefined;
  cwd: string;
  projectDir: string | undefined;
  runner: {
    onSpawn: (child: import('node:child_process').ChildProcess) => void;
    abortSignal: AbortSignal;
    onOutput: (chunk: string) => void;
  };
}

async function spawnRunnerProgram(
  runner: InternalExecuteOptions['runner'],
  command: string,
  args: string[],
  cwd: string,
): Promise<{ exitCode: number | undefined; cancelled: boolean }> {
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

  const { promise, resolve, reject } = Promise.withResolvers<{ exitCode: number | undefined; cancelled: boolean }>();
  childProcess.on('error', (error) => {
    runner.abortSignal.removeEventListener('abort', onAbort);
    reject(error);
  });
  childProcess.on('close', (code) => {
    runner.abortSignal.removeEventListener('abort', onAbort);
    resolve({ exitCode: code === null ? undefined : code, cancelled: runner.abortSignal.aborted });
  });
  return promise;
}

async function executeShellProgram(options: InternalExecuteOptions): Promise<{ exitCode: number | undefined; cancelled: boolean }> {
  const extension = process.platform === 'win32' ? 'ps1' : 'sh';
  const scriptPath = createTempScript(getTempScriptPath(options.cwd, extension), options.program);
  return spawnRunnerProgram(
    options.runner,
    process.platform === 'win32' ? 'powershell.exe' : 'bash',
    process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass', '-File', scriptPath] : [scriptPath],
    options.cwd,
  );
}

async function executePythonProgram(options: InternalExecuteOptions): Promise<{ exitCode: number | undefined; cancelled: boolean }> {
  const scriptPath = createTempScript(getTempScriptPath(options.cwd, 'py'), options.program);
  const args = ['--isolated'];
  for (const dep of options.dependencies ?? []) args.push('--with', dep);
  args.push('--from', 'python', 'python', scriptPath);
  return spawnRunnerProgram(options.runner, 'uvx', args, options.cwd);
}

async function executeJavascriptProgram(options: InternalExecuteOptions, projectDir: string): Promise<{ exitCode: number | undefined; cancelled: boolean }> {
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

export async function execute(options: ExecuteOptions): Promise<ExecuteResult> {
  const { sessionId, language, dependencies, earlyTimeoutMs } = options;
  let { program } = options;
  if (language === 'shell') program = stripHeadTailPipes(program).script;
  const timeoutMs = earlyTimeoutMs ?? RUNNER_EARLY_TIMEOUT_MS;
  const cwd = options.cwd ?? process.cwd();

  const existingJob = globalJobRegistry.get(sessionId);
  if (existingJob?.status === 'running') throw new Error('A task is already running. Use wait() or abort() first.');
  if (existingJob) cleanupJob(sessionId);

  const logPath = getRunnerLogPath(sessionId);
  let projectDir: string | undefined;
  if (language === 'javascript') projectDir = getRunnerProjectDir();
  else if (language === 'python') projectDir = getRunnerProjectDir(sessionId);

  const job = new ActiveJob(sessionId, logPath, projectDir, options.parentSessionId);
  globalJobRegistry.set(job.sessionId, job);

  const runner = {
    onSpawn: (child: import('node:child_process').ChildProcess) => { job.childProcess = child; },
    abortSignal: job.abortController.signal,
    onOutput: (chunk: string) => job.writeOutput(chunk),
  };

  let capturedError: unknown;
  const closePromise = (async () => {
    try {
      const result = language === 'shell'
        ? await executeShellProgram({ program, language, dependencies, cwd, projectDir, runner })
        : language === 'python'
          ? await executePythonProgram({ program, language, dependencies, cwd, projectDir, runner })
          : await executeJavascriptProgram({ program, language, dependencies, cwd, projectDir, runner }, projectDir!);
      job.childProcess = null;
      if (job.status === 'running') job.status = result.cancelled ? 'aborted' : 'completed';
      if (result.exitCode !== undefined && result.exitCode !== 0) {
        const msg = `\n[runner] Command exited with code ${result.exitCode}\n`;
        job.writeOutput(msg);
      }
    } catch (error) {
      if (job.status === 'running') job.status = 'aborted';
      const msg = `\n[runner] ${error instanceof Error ? error.message : String(error)}\n`;
      job.writeOutput(msg);
      capturedError = error;
    }
  })();
  job.closePromise = closePromise;

  try {
    const isCompletedEarly = await Promise.race([
      closePromise.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);

    if (isCompletedEarly) {
      const fullOutput = job.finalOutput;
      if (capturedError) { cleanupJob(sessionId); throw capturedError; }
      cleanupJob(sessionId);
      return { output: truncateTail(fullOutput, MAX_OUTPUT_BYTES).trim() || '(no output)', background: false, message: '[System] Task completed.' };
    }
  } catch (error: unknown) {
    if (error === capturedError) throw error;
    cleanupJob(sessionId);
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      const executable = language === 'python' ? 'uvx' : language === 'javascript' ? 'npx' : process.platform === 'win32' ? 'powershell.exe' : 'bash';
      throw new Error(`Error: '${executable}' executable not found. Please ensure '${executable}' is installed and available on your PATH.`);
    }
    throw error;
  }

  job.bytesRead = job.finalOutput.length;
  return {
    output: truncateTail(job.finalOutput, MAX_OUTPUT_BYTES).trim() || '(no output yet)',
    background: true,
    jobId: sessionId,
    message: '[System] Task has been backgrounded. Use wait() to check progress.',
  };
}

export async function wait(options: WaitOptions): Promise<WaitResult> {
  const { sessionId, ms } = options;
  const job = globalJobRegistry.get(sessionId);
  if (!job) return { output: '', completed: true, message: '[System] No active job — it has already finished or was cleaned up.' };

  if (job.status === 'completed' || job.status === 'aborted') {
    const newOutput = truncateTail(job.finalOutput.substring(job.bytesRead), MAX_OUTPUT_BYTES).trim();
    cleanupJob(sessionId);
    return {
      output: newOutput, completed: true,
      message: job.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.',
    };
  }

  await Promise.race([job.closePromise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  const newOutput = job.finalOutput.substring(job.bytesRead).trim();
  job.bytesRead = job.finalOutput.length;

  if (job.status !== 'running') {
    cleanupJob(sessionId);
    return { output: newOutput || '(no new output)', completed: true, message: job.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.' };
  }

  if (!newOutput) {
    return {
      output: '',
      completed: false,
      message:
        '[System] Task still running. No new output during this wait.\n' +
        '⚠️ Risk warning: Output stream is silent. This strongly suggests the process may be hung ' +
        'or stuck in an infinite loop. Evaluate the last few lines of output carefully.\n' +
        'Unless you are sure it is doing heavy background computation, continued waiting is usually pointless. ' +
        'The wise choice is to call abort() and redesign a more robust command.',
    };
  }

  return { output: truncateTail(newOutput, MAX_OUTPUT_BYTES), completed: false, message: '[System] Task still running in background.' };
}

export function abort(sessionId: string): string {
  const job = globalJobRegistry.get(sessionId);
  if (!job) return 'No active task found to abort.';
  cleanupJob(sessionId);
  return '[System] Task has been forcefully terminated.';
}

export function getSessionId(context: Record<string, unknown>): string {
  if (typeof context.sessionID === 'string') return context.sessionID;
  if (typeof context.sessionId === 'string') return context.sessionId;
  return '';
}
