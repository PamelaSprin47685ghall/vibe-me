import { getRunnerLogPath, getRunnerProjectDir, RUNNER_EARLY_TIMEOUT_MS } from './paths.js';
import { stripHeadTailPipes } from './no-head-tail.js';
import { ActiveJob, cleanupRegistry, globalJobRegistry, MAX_OUTPUT_BYTES } from './job.js';
import { executeShellProgram, executePythonProgram, executeJavascriptProgram } from './programs.js';
import type { ExecuteOptions, ExecuteResult } from './types.js';

export function truncateTail(text: string, max: number): string {
  return text.length <= max ? text : text.slice(-max);
}

export function getActiveJobs(): Map<string, ActiveJob> {
  return globalJobRegistry;
}

export function cleanupJob(sessionId: string): void {
  cleanupRegistry(globalJobRegistry, sessionId);
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

export function getSessionId(context: Record<string, unknown>): string {
  if (typeof context.sessionID === 'string') return context.sessionID;
  if (typeof context.sessionId === 'string') return context.sessionId;
  return '';
}


