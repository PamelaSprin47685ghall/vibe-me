import { chmodSync, createWriteStream, existsSync, unlinkSync, rmSync, writeFileSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { killTree } from './process.js';
import { getRunnerProjectDir } from './paths.js';

export const MAX_OUTPUT_BYTES = 1024 * 1024;

export type JobStatus = 'running' | 'completed' | 'aborted';

export class ActiveJob {
  public childProcess: ChildProcess | null = null;
  public status: JobStatus = 'running';
  public readonly abortController = new AbortController();
  public bytesRead = 0;
  public finalOutput = '';
  public closePromise: Promise<void> = Promise.resolve();

  private writeStream: WriteStream | null;
  private cleanupExecuted = false;

  constructor(
    public readonly sessionId: string,
    public readonly stdoutFile: string,
    public readonly projectDir: string | undefined,
    public readonly parentSessionId?: string,
    public readonly startTime = Date.now(),
  ) {
    this.writeStream = createWriteStream(stdoutFile, { flags: 'w' });
  }

  public writeOutput(chunk: string): void {
    if (this.finalOutput.length < MAX_OUTPUT_BYTES) {
      this.finalOutput += chunk;
    }
    try {
      this.writeStream?.write(chunk);
    } catch {}
  }

  public dispose(): void {
    if (this.cleanupExecuted) return;
    this.cleanupExecuted = true;

    if (this.status === 'running') {
      try {
        this.abortController.abort();
      } catch {}
      this.killProcess();
      this.status = 'aborted';
    }

    this.closeStream();
    this.removeFiles();
  }

  private killProcess(): void {
    if (this.childProcess) {
      killTree(this.childProcess);
      this.childProcess = null;
    }
  }

  private closeStream(): void {
    if (this.writeStream) {
      try {
        this.writeStream.end();
      } catch {}
      this.writeStream = null;
    }
  }

  private removeFiles(): void {
    if (existsSync(this.stdoutFile)) {
      try {
        unlinkSync(this.stdoutFile);
      } catch {}
    }

    const sessionDir = getRunnerProjectDir(this.sessionId);
    if (existsSync(sessionDir)) {
      try {
        rmSync(sessionDir, { recursive: true, force: true });
      } catch {}
    }

    if (this.projectDir && this.projectDir !== getRunnerProjectDir()) {
      if (existsSync(this.projectDir)) {
        try {
          rmSync(this.projectDir, { recursive: true, force: true });
        } catch {}
      }
    }
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}

export function createTempScript(scriptPath: string, program: string): string {
  writeFileSync(scriptPath, program, 'utf-8');
  if (process.platform !== 'win32') chmodSync(scriptPath, 0o755);
  return scriptPath;
}

export function getTempScriptPath(sessionId: string, extension: string): string {
  return `${getRunnerProjectDir(sessionId)}/script.${extension}`;
}

export class JobRegistry {
  private jobs = new Map<string, ActiveJob>();

  public register(job: ActiveJob): void {
    this.jobs.set(job.sessionId, job);
  }

  public get(sessionId: string): ActiveJob | undefined {
    return this.jobs.get(sessionId);
  }

  public delete(sessionId: string): void {
    this.jobs.delete(sessionId);
  }

  public getAll(): Map<string, ActiveJob> {
    return this.jobs;
  }

  public cleanup(sessionId: string): void {
    const directJob = this.jobs.get(sessionId);
    if (directJob) {
      directJob.dispose();
      this.delete(sessionId);
      return;
    }

    for (const job of this.jobs.values()) {
      if (job.parentSessionId === sessionId) {
        job.dispose();
        this.delete(job.sessionId);
      }
    }
  }

  public clear(): void {
    for (const job of this.jobs.values()) {
      job.dispose();
    }
    this.jobs.clear();
  }
}

export const globalJobRegistry = new JobRegistry();
