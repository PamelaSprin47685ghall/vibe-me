import type { CoordinatorDeps } from './deps.js';
import type { FinderLike } from './types.js';

export async function acquireFinder(
  externalBasePath: string | null,
  cwd: string,
  deps: CoordinatorDeps,
): Promise<FinderLike> {
  return externalBasePath ? await deps.createFinder(externalBasePath) : await deps.getCachedFinder(cwd);
}

export function releaseFinder(finder: FinderLike, externalBasePath: string | null): void {
  if (externalBasePath) {
    try {
      finder.destroy();
    } catch {}
  }
}
