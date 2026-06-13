import { describe, expect, it } from 'vitest';
import {
  runExecutorProgramWithDeps,
  type Clock,
  type EventEmitterLike,
  type SpawnedChildProcessLike,
} from './programs.js';

type Listener = (...args: unknown[]) => void;

function createFakeEmitter(): EventEmitterLike & { emit(event: 'data', chunk: Buffer): void } {
  const listeners = new Map<string, Listener[]>();
  return {
    on(event: 'data', listener: (chunk: Buffer) => void) {
      const list = listeners.get(event) ?? [];
      list.push(listener as Listener);
      listeners.set(event, list);
    },
    removeAllListeners(event?: string) {
      if (event) listeners.delete(event);
      else listeners.clear();
    },
    emit(event: 'data', chunk: Buffer) {
      for (const listener of listeners.get(event) ?? []) {
        (listener as (chunk: Buffer) => void)(chunk);
      }
    },
  };
}

function createFakeChildProcess() {
  const listeners = new Map<string, Listener[]>();
  const stdoutEmitter = createFakeEmitter();
  const stderrEmitter = createFakeEmitter();

  function on(event: string, listener: Listener) {
    const list = listeners.get(event) ?? [];
    list.push(listener);
    listeners.set(event, list);
  }

  return {
    pid: 1234,
    kill: () => true,
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    stdoutEmitter,
    stderrEmitter,
    on,
    emitClose(code: number | null, signal: NodeJS.Signals | null) {
      for (const listener of listeners.get('close') ?? []) {
        (listener as (code: number | null, signal: NodeJS.Signals | null) => void)(code, signal);
      }
    },
    emitError(error: Error) {
      for (const listener of listeners.get('error') ?? []) {
        (listener as (error: Error) => void)(error);
      }
    },
  } as SpawnedChildProcessLike & {
    stdoutEmitter: ReturnType<typeof createFakeEmitter>;
    stderrEmitter: ReturnType<typeof createFakeEmitter>;
    emitClose(code: number | null, signal: NodeJS.Signals | null): void;
    emitError(error: Error): void;
  };
}

function createFakeClock(): Clock & { advance(): void } {
  let timer: (() => void) | null = null;
  return {
    setTimeout(callback) {
      timer = callback;
      return 1;
    },
    clearTimeout() {
      timer = null;
    },
    advance() {
      timer?.();
      timer = null;
    },
  };
}

function createKillSpy(): {
  kill: (child: SpawnedChildProcessLike) => void;
  killed: SpawnedChildProcessLike[];
} {
  const killed: SpawnedChildProcessLike[] = [];
  return {
    kill: (child) => killed.push(child),
    killed,
  };
}

describe('runExecutorProgramWithDeps', () => {
  it('collects stdout/stderr and returns code 0 on normal close', async () => {
    const child = createFakeChildProcess();
    const clock = createFakeClock();
    const { kill, killed } = createKillSpy();

    const promise = runExecutorProgramWithDeps(child, kill, 5000, clock);
    child.stdoutEmitter.emit('data', Buffer.from('hello'));
    child.stderrEmitter.emit('data', Buffer.from('world'));
    child.emitClose(0, null);

    const result = await promise;
    expect(result.code).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toBe('hello');
    expect(result.stderr).toBe('world');
    expect(killed).toHaveLength(0);
  });

  it('returns non-zero code on close with non-zero exit code', async () => {
    const child = createFakeChildProcess();
    const clock = createFakeClock();
    const { kill, killed } = createKillSpy();

    const promise = runExecutorProgramWithDeps(child, kill, 5000, clock);
    child.emitClose(7, null);

    const result = await promise;
    expect(result.code).toBe(7);
    expect(result.timedOut).toBe(false);
    expect(killed).toHaveLength(0);
  });

  it('resolves with null code on error event', async () => {
    const child = createFakeChildProcess();
    const clock = createFakeClock();
    const { kill, killed } = createKillSpy();

    const promise = runExecutorProgramWithDeps(child, kill, 5000, clock);
    child.stdoutEmitter.emit('data', Buffer.from('partial output'));
    child.emitError(new Error('spawn failed'));

    const result = await promise;
    expect(result.code).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toBe('partial output');
    expect(killed).toHaveLength(0);
  });

  it('calls kill and marks timedOut when timeout fires', async () => {
    const child = createFakeChildProcess();
    const clock = createFakeClock();
    const { kill, killed } = createKillSpy();

    const promise = runExecutorProgramWithDeps(child, kill, 100, clock);
    clock.advance();

    const result = await promise;
    expect(result.code).toBeNull();
    expect(result.timedOut).toBe(true);
    expect(killed).toHaveLength(1);
    expect(killed[0]).toBe(child);
  });

  it('clears timeout when close fires before timeout', async () => {
    const child = createFakeChildProcess();
    const clock = createFakeClock();
    const { kill, killed } = createKillSpy();

    const promise = runExecutorProgramWithDeps(child, kill, 100, clock);
    child.emitClose(0, null);
    clock.advance();

    const result = await promise;
    expect(result.code).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(killed).toHaveLength(0);
  });
});
