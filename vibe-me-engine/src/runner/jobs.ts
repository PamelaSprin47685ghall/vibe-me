import { getRunnerLogPath, getRunnerProjectDir, RUNNER_EARLY_TIMEOUT_MS } from './paths.js';
import { stripHeadTailPipes } from './no-head-tail.js';
import { cleanupRegistry, MAX_OUTPUT_BYTES } from './job.js';
import type { JobEntry } from './job.js';
import { emptyJob, jobOutput } from './job.js';
import { createHandles } from './job.js';
import { executeShellProgram, executePythonProgram, executeJavascriptProgram } from './programs.js';
import type { InternalExecuteOptions } from './programs.js';
import type { ExecuteOptions, ExecuteResult } from './types.js';
import type { JobRegistry } from './job-registry.js';
import { transition } from './state.js';
import { outputEvent, exitEvent } from '../types/runner/event.js';

export function truncateTail(text: string, max: number): string {
  return text.length <= max ? text : text.slice(-max);
}

export function getActiveJobs(jobs: JobRegistry): Map<string, JobEntry> {
  return jobs;
}

export function cleanupJob(jobs: JobRegistry, sessionId: string): void {
  cleanupRegistry(jobs, sessionId);
}

function resolveProjectDir(language: string, sessionId: string): string | undefined {
  if (language === 'javascript') return getRunnerProjectDir();
  if (language === 'python') return getRunnerProjectDir(sessionId);
  return undefined;
}

function makeRunnerCallbacks(entry: JobEntry, handles: import('./job-effects.js').JobHandles): InternalExecuteOptions['runner'] {
  return {
    onSpawn: (child) => { handles.childProcess = child; },
    abortSignal: handles.abortController.signal,
    onOutput: (chunk) => {
      entry.record = { ...entry.record, state: transition(entry.record.state, outputEvent(chunk)) };
      try { handles.writeStream?.write(chunk); } catch {}
    },
    onExit: (code) => {
      if (code !== 0 && code !== null) {
        const msg = `\n[runner] Command exited with code ${code}\n`;
        entry.record = { ...entry.record, state: transition(entry.record.state, outputEvent(msg)) };
        try { handles.writeStream?.write(msg); } catch {}
      }
      entry.record = { ...entry.record, state: transition(entry.record.state, exitEvent(code)) };
    },
    onError: (message) => {
      const msg = `\n[runner] ${message}\n`;
      entry.record = { ...entry.record, state: transition(entry.record.state, outputEvent(msg)) };
      try { handles.writeStream?.write(msg); } catch {}
      entry.record = { ...entry.record, state: transition(entry.record.state, exitEvent(null)) };
    },
  };
}

async function runProgram(
  program: string,
  language: string,
  options: ExecuteOptions,
  runner: InternalExecuteOptions['runner'],
  projectDir: string | undefined,
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const execOpts: InternalExecuteOptions = {
    program,
    language: options.language,
    dependencies: options.dependencies,
    cwd,
    projectDir,
    runner,
  };
  if (language === 'shell') return executeShellProgram(execOpts);
  if (language === 'python') return executePythonProgram(execOpts);
  return executeJavascriptProgram(execOpts, projectDir!);
}

export async function execute(options: ExecuteOptions): Promise<ExecuteResult> {
  const { jobs, sessionId, language, earlyTimeoutMs } = options;
  let { program } = options;
  if (language === 'shell') program = stripHeadTailPipes(program).script;
  const timeoutMs = earlyTimeoutMs ?? RUNNER_EARLY_TIMEOUT_MS;
  const startTime = Date.now();

  const existingEntry = jobs.get(sessionId);
  if (existingEntry?.record.state._tag === 'Running') throw new Error('A task is already running. Use wait() or abort() first.');
  if (existingEntry) cleanupJob(jobs, sessionId);

  const logPath = getRunnerLogPath(sessionId);
  const projectDir = resolveProjectDir(language, sessionId);
  const record = emptyJob(sessionId, logPath, projectDir, startTime, options.parentSessionId);
  const handles = createHandles(logPath);
  const entry: JobEntry = { record, handles };
  jobs.set(sessionId, entry);

  const runner = makeRunnerCallbacks(entry, handles);
  let capturedError: unknown;

  const closePromise = runProgram(program, language, options, runner, projectDir).catch((error) => {
    if (entry.record.state._tag === 'Running') {
      const msg = `\n[runner] ${error instanceof Error ? error.message : String(error)}\n`;
      entry.record = { ...entry.record, state: transition(entry.record.state, outputEvent(msg)) };
      try { handles.writeStream?.write(msg); } catch {}
      entry.record = { ...entry.record, state: transition(entry.record.state, exitEvent(null)) };
    }
    capturedError = error;
  });
  handles.closePromise = closePromise;

  try {
    const isCompletedEarly = await Promise.race([
      closePromise.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (isCompletedEarly) {
      const fullOutput = jobOutput(entry.record.state);
      if (capturedError) { cleanupJob(jobs, sessionId); throw capturedError; }
      cleanupJob(jobs, sessionId);
      return { _tag: 'Completed', output: truncateTail(fullOutput, MAX_OUTPUT_BYTES).trim() || '(no output)' };
    }
  } catch (error: unknown) {
    cleanupJob(jobs, sessionId);
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      const executable = language === 'python' ? 'uvx' : language === 'javascript' ? 'npx' : process.platform === 'win32' ? 'powershell.exe' : 'bash';
      throw new Error(`Error: '${executable}' executable not found. Please ensure '${executable}' is installed and available on your PATH.`);
    }
    throw error;
  }

  return {
    _tag: 'Backgrounded',
    output: truncateTail(jobOutput(entry.record.state), MAX_OUTPUT_BYTES).trim() || '(no output yet)',
    jobId: sessionId,
  };
}

export function getSessionId(context: Record<string, unknown>): string {
  if (typeof context.sessionID === 'string') return context.sessionID;
  if (typeof context.sessionId === 'string') return context.sessionId;
  return '';
}