import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const EXECUTOR_LOG_DIR = join(tmpdir(), 'omp-kunwei-executor');

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function sanitizeId(id: string): string {
  return id.replace(/\//g, '-');
}

export function getExecutorProjectDir(sessionId?: string): string {
  if (sessionId) {
    const dir = join(EXECUTOR_LOG_DIR, `executor-${sanitizeId(sessionId)}`);
    ensureDir(dir);
    return dir;
  }
  const dir = join(EXECUTOR_LOG_DIR, 'executor');
  ensureDir(dir);
  return dir;
}

export function getExecutorTempScriptPath(sessionId: string, extension: string): string {
  return `${getExecutorProjectDir(sessionId)}/script.${extension}`;
}
