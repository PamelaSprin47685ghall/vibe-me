import type { FileFinder } from '@ff-labs/fff-node';
import { createFinder } from './finder.js';

export let activeFinders = new Map<string, FileFinder>();
export let pendingFinders = new Map<string, Promise<FileFinder>>();

export async function obtainFinder(cwd: string): Promise<FileFinder> {
  const cached = activeFinders.get(cwd);
  if (cached && !cached.isDestroyed) return cached;

  const pending = pendingFinders.get(cwd);
  if (pending) return pending;

  const promise = createFinder(cwd);
  pendingFinders.set(cwd, promise);
  try {
    const finder = await promise;
    activeFinders.set(cwd, finder);
    return finder;
  } finally {
    pendingFinders.delete(cwd);
  }
}

export function releaseFinder(cwd: string): void {
  const finder = activeFinders.get(cwd);
  if (finder && !finder.isDestroyed) {
    try { finder.destroy(); } catch { /* best-effort */ }
  }
  activeFinders.delete(cwd);
  pendingFinders.delete(cwd);
}

export function releaseAll(): void {
  for (const cwd of activeFinders.keys()) releaseFinder(cwd);
}