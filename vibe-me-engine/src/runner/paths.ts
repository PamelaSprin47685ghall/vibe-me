import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const RUNNER_LOG_DIR = join(tmpdir(), 'omp-kunwei-runner');
export const RUNNER_EARLY_TIMEOUT_MS = 5000;
export const RUNNER_MAX_WAIT_MS = 30000;
export const RUNNER_MIN_WAIT_MS = 100;

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function getRunnerLogPath(sessionId: string): string {
  ensureDir(RUNNER_LOG_DIR);
  return join(RUNNER_LOG_DIR, `runner-${sessionId}.log`);
}

export function getRunnerProjectDir(sessionId?: string): string {
  if (sessionId) {
    const dir = join(RUNNER_LOG_DIR, `runner-${sessionId}`);
    ensureDir(dir);
    return dir;
  }
  const dir = join(RUNNER_LOG_DIR, 'runner');
  ensureDir(dir);
  return dir;
}

export function getRunnerTempScriptPath(sessionId: string, extension: string): string {
  return join(getRunnerProjectDir(sessionId), `script.${extension}`);
}
