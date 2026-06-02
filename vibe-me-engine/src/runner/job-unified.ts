import type { ChildProcess } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { killTree } from './process';

export type JobStatus = 'running' | 'completed' | 'aborted' | 'error';

export class ActiveJob implements Disposable {
  public childProcess: ChildProcess | null = null;
  public bytesRead = 0;
  public status: JobStatus = 'running';
  public readonly abortController = new AbortController();
  private writeStream?: WriteStream;
  private stdoutFile?: string;

  constructor(
    public readonly id: string,
    public readonly command: string
  ) {}

  setProcess(proc: ChildProcess): void {
    this.childProcess = proc;
  }

  setOutputStream(stream: WriteStream, filePath: string): void {
    this.writeStream = stream;
    this.stdoutFile = filePath;
  }

  abort(): void {
    if (this.status === 'running') {
      this.status = 'aborted';
      this.abortController.abort();
    }
  }

  complete(): void {
    if (this.status === 'running') {
      this.status = 'completed';
    }
  }

  error(): void {
    if (this.status === 'running') {
      this.status = 'error';
    }
  }

  [Symbol.dispose](): void {
    if (this.status === 'running') this.abortController.abort();

    if (this.childProcess && this.childProcess.pid) {
      try {
        killTree(this.childProcess.pid);
      } catch {}
    }

    if (this.writeStream && !this.writeStream.closed) {
      try {
        this.writeStream.end();
      } catch {}
    }

    if (this.stdoutFile) {
      try {
        unlinkSync(this.stdoutFile);
      } catch {}
    }

    this.childProcess = null;
    this.writeStream = undefined;
    this.stdoutFile = undefined;
  }
}

export class JobRegistry {
  private jobs = new Map<string, ActiveJob>();

  register(job: ActiveJob): void {
    this.jobs.set(job.id, job);
  }

  get(id: string): ActiveJob | undefined {
    return this.jobs.get(id);
  }

  delete(id: string): boolean {
    const job = this.jobs.get(id);
    if (job) {
      job[Symbol.dispose]();
      return this.jobs.delete(id);
    }
    return false;
  }

  clear(): void {
    for (const job of this.jobs.values()) {
      job[Symbol.dispose]();
    }
    this.jobs.clear();
  }

  getAll(): ActiveJob[] {
    return Array.from(this.jobs.values());
  }
}
