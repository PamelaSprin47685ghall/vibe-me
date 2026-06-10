import type { FileFinder } from '@ff-labs/fff-node';
import { createFinder } from './finder.js';

const instances = new Map<string, FileFinder>();
const pending = new Map<string, Promise<FileFinder>>();

export async function getCachedFinder(cwd: string): Promise<FileFinder> {
  const existing = instances.get(cwd);
  if (existing && !existing.isDestroyed) return existing;
  const inFlight = pending.get(cwd);
  if (inFlight) return inFlight;
  const promise = createFinder(cwd);
  pending.set(cwd, promise);
  try {
    const finder = await promise;
    instances.set(cwd, finder);
    return finder;
  } finally {
    pending.delete(cwd);
  }
}

export function destroyFinder(cwd: string): void {
  const finder = instances.get(cwd);
  if (finder && !finder.isDestroyed) { try { finder.destroy(); } catch {} }
  instances.delete(cwd);
  pending.delete(cwd);
}

export function destroyAllFinders(): void {
  for (const cwd of [...instances.keys()]) destroyFinder(cwd);
}