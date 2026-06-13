import type { FileFinder } from '@ff-labs/fff-node';
import { ok, type Result } from '../types/general.js';
import { createFinder } from './finder.js';

const instances = new Map<string, FileFinder>();
const pending = new Map<string, Promise<Result<FileFinder, string>>>();

export async function getCachedFinder(cwd: string): Promise<Result<FileFinder, string>> {
  const existing = instances.get(cwd);
  if (existing && !existing.isDestroyed) return ok(existing);
  const inFlight = pending.get(cwd);
  if (inFlight) return inFlight;
  const promise = createFinder(cwd) as Promise<Result<FileFinder, string>>;
  pending.set(cwd, promise);
  try {
    const result = await promise;
    if (result._tag === 'Ok') instances.set(cwd, result.value);
    return result;
  } finally {
    pending.delete(cwd);
  }
}

export function destroyFinder(cwd: string): void {
  const finder = instances.get(cwd);
  if (finder && !finder.isDestroyed) finder.destroy();
  instances.delete(cwd);
  pending.delete(cwd);
}

export function destroyAllFinders(): void {
  for (const cwd of [...instances.keys()]) destroyFinder(cwd);
}
