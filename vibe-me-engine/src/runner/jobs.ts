import { getRunnerLogPath, getRunnerProjectDir, RUNNER_EARLY_TIMEOUT_MS } from './paths.js';
import { stripHeadTailPipes } from './no-head-tail.js';
import { cleanupRegistry, MAX_OUTPUT_BYTES } from './job.js';
import type { JobEntry } from './job.js';
import { emptyJob, appendOutput, markCompleted, markAborted } from './job.js';
import { createHandles } from './job.js';
import { executeShellProgram, executePythonProgram, executeJavascriptProgram } from './programs.js';
import type { ExecuteOptions, ExecuteResult } from './types.js';
import type { JobRegistry } from './job-registry.js';


export function truncateTail(text: string, max: number): string {
  return text.length <= max ? text : text.slice(-max);
}

export function getActiveJobs(jobs: JobRegistry): Map<string, JobEntry> {
  return jobs;
}

export function cleanupJob(jobs: JobRegistry, sessionId: string): void {
  cleanupRegistry(jobs, sessionId);
}

export async function execute(options: ExecuteOptions): Promise<ExecuteResult> {
  const { jobs, sessionId, language, dependencies, earlyTimeoutMs } = options;
  let { program } = options;
  if (language === 'shell') program = stripHeadTailPipes(program).script;
  const timeoutMs = earlyTimeoutMs ?? RUNNER_EARLY_TIMEOUT_MS;
  const cwd = options.cwd ?? process.cwd();

  const existingEntry = jobs.get(sessionId);
  if (existingEntry?.record.status._tag === 'Running') throw new Error('A task is already running. Use wait() or abort() first.');
  if (existingEntry) cleanupJob(jobs, sessionId);

  const logPath = getRunnerLogPath(sessionId);
  let projectDir: string | undefined;
  if (language === 'javascript') projectDir = getRunnerProjectDir();
  else if (language === 'python') projectDir = getRunnerProjectDir(sessionId);

  const record = emptyJob(sessionId, logPath, projectDir, options.parentSessionId);
  const handles = createHandles(logPath);
  const entry: JobEntry = { record, handles };
  jobs.set(sessionId, entry);

  const runner = {
    onSpawn: (child: import('node:child_process').ChildProcess) => { handles.childProcess = child; },
    abortSignal: handles.abortController.signal,
    onOutput: (chunk: string) => {
      entry.record = appendOutput(entry.record, chunk);
      try { handles.writeStream?.write(chunk); } catch {}
    },
  };

  let capturedError: unknown;
  const closePromise = (async () => {
    try {
      const result = language === 'shell'
        ? await executeShellProgram({ program, language, dependencies, cwd, projectDir, runner })
        : language === 'python'
          ? await executePythonProgram({ program, language, dependencies, cwd, projectDir, runner })
          : await executeJavascriptProgram({ program, language, dependencies, cwd, projectDir, runner }, projectDir!);
      handles.childProcess = null;
      if (entry.record.status._tag === 'Running') {
        entry.record = result.cancelled ? markAborted(entry.record) : markCompleted(entry.record);
      }
      if (result.exitCode !== undefined && result.exitCode !== 0) {
        const msg = `\n[runner] Command exited with code ${result.exitCode}\n`;
        entry.record = appendOutput(entry.record, msg);
        try { handles.writeStream?.write(msg); } catch {}
      }
    } catch (error) {
      if (entry.record.status._tag === 'Running') entry.record = markAborted(entry.record);
      const msg = `\n[runner] ${error instanceof Error ? error.message : String(error)}\n`;
      entry.record = appendOutput(entry.record, msg);
      try { handles.writeStream?.write(msg); } catch {}
      capturedError = error;
    }
  })();
  handles.closePromise = closePromise;

  try {
    const isCompletedEarly = await Promise.race([
      closePromise.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);

    if (isCompletedEarly) {
      const fullOutput = entry.record.finalOutput;
      if (capturedError) { cleanupJob(jobs, sessionId); throw capturedError; }
      cleanupJob(jobs, sessionId);
      return { output: truncateTail(fullOutput, MAX_OUTPUT_BYTES).trim() || '(no output)', background: false, message: '[System] Task completed.' };
    }
  } catch (error: unknown) {
    if (error === capturedError) throw error;
    cleanupJob(jobs, sessionId);
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      const executable = language === 'python' ? 'uvx' : language === 'javascript' ? 'npx' : process.platform === 'win32' ? 'powershell.exe' : 'bash';
      throw new Error(`Error: '${executable}' executable not found. Please ensure '${executable}' is installed and available on your PATH.`);
    }
    throw error;
  }

  return {
    output: truncateTail(entry.record.finalOutput, MAX_OUTPUT_BYTES).trim() || '(no output yet)',
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
