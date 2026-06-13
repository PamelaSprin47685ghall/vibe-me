import { afterEach, describe, expect, it, vi } from 'vitest';
import { killTree, type ChildProcessLike } from './process.js';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

function withPlatform(platform: string, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(process, 'platform', original);
    else Object.defineProperty(process, 'platform', { value: process.platform });
  }
}

describe('killTree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing for null', () => {
    expect(() => killTree(null)).not.toThrow();
  });

  it('does nothing when pid is missing', () => {
    const child: ChildProcessLike = {};
    expect(() => killTree(child)).not.toThrow();
  });

  it('on unix, kills the process group with SIGKILL', () => {
    withPlatform('linux', () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      killTree({ pid: 1234 });
      expect(killSpy).toHaveBeenCalledWith(-1234, 'SIGKILL');
    });
  });

  it('falls back to child.kill when process group kill fails', () => {
    withPlatform('linux', () => {
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('EPERM');
      });
      const childKill = vi.fn();
      killTree({ pid: 1234, kill: childKill });
      expect(childKill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  it('on windows, spawns taskkill', () => {
    withPlatform('win32', () => {
      const spawnMock = vi
        .mocked(childProcess.spawn)
        .mockReturnValue({} as ReturnType<typeof childProcess.spawn>);
      killTree({ pid: 1234 });
      expect(spawnMock).toHaveBeenCalledWith(
        'taskkill',
        ['/F', '/T', '/PID', '1234'],
        { stdio: 'ignore' },
      );
    });
  });

  it('tolerates repeated killTree calls', () => {
    withPlatform('linux', () => {
      const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
      Array.from({ length: 100 }, () => killTree({ pid: 1234 }));
      expect(killSpy).toHaveBeenCalledTimes(100);
    });
  });
});
