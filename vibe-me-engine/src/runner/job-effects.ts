import { createWriteStream, existsSync, unlinkSync, rmSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { killTree } from './process.js';
import { getRunnerProjectDir } from './paths.js';
import type { JobRecord } from './job-data.js';

export interface JobHandles {
  childProcess: ChildProcess | null;
  writeStream: WriteStream | null;
  readonly abortController: AbortController;
  closePromise: Promise<void>;
}

export function createHandles(stdoutFile: string): JobHandles {
  return {
    childProcess: null,
    writeStream: createWriteStream(stdoutFile, { flags: 'w' }),
    abortController: new AbortController(),
    closePromise: Promise.resolve(),
  };
}

export function releaseHandles(handles: JobHandles): void {
  try { handles.abortController.abort(); } catch {}
  if (handles.childProcess) {
    killTree(handles.childProcess);
    handles.childProcess = null;
  }
  if (handles.writeStream) {
    try { handles.writeStream.end(); } catch {}
    handles.writeStream = null;
  }
}

export function cleanupFiles(record: JobRecord): void {
  if (existsSync(record.stdoutFile)) {
    try { unlinkSync(record.stdoutFile); } catch {}
  }
  const sessionDir = getRunnerProjectDir(record.sessionId);
  if (existsSync(sessionDir)) {
    try { rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  }
  if (record.projectDir && record.projectDir !== getRunnerProjectDir()) {
    if (existsSync(record.projectDir)) {
      try { rmSync(record.projectDir, { recursive: true, force: true }); } catch {}
    }
  }
}