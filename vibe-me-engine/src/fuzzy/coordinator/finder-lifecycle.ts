import type { Result } from '../../types/general.js';
import type { CoordinatorDeps } from './deps.js';
import type { FinderLike } from './types.js';

export async function acquireFinder(
  externalBasePath: string | null,
  cwd: string,
  deps: CoordinatorDeps,
): Promise<Result<FinderLike, string>> {
  return externalBasePath ? await deps.createFinder(externalBasePath) : await deps.getCachedFinder(cwd);
}

export function releaseFinder(finder: FinderLike, externalBasePath: string | null): void {
  if (externalBasePath) finder.destroy();
}
