import type { IteratorStore } from '../../util/iterator.js';
import { globalIteratorStore, storeIterator, consumeIterator } from '../../util/iterator.js';
import type { Result } from '../../types/general.js';
import { createFinder } from '../finder.js';
import { getCachedFinder } from '../finder-registry.js';
import { buildQuery, resolveFuzzySearchPath } from '../query.js';
import type { ResolvedFuzzySearchPath } from '../query.js';
import { formatGrepOutput, fileAnnotation } from '../format.js';
import type { FinderLike } from './types.js';

export interface CoordinatorDeps {
  createFinder: (basePath: string) => Promise<Result<FinderLike, string>>;
  getCachedFinder: (cwd: string) => Promise<Result<FinderLike, string>>;
  buildQuery: (
    fpath: string | undefined | null,
    pattern: string,
    exclude: string | string[] | undefined | null,
    cwd?: string,
    allowExternal?: boolean,
  ) => string;
  resolveFuzzySearchPath: (inputPath: string | undefined | null, cwd?: string) => ResolvedFuzzySearchPath;
  formatGrepOutput: (result: import('../format.js').GrepResultLike | null | undefined) => string;
  fileAnnotation: (item: {
    gitStatus?: string;
    totalFrecencyScore?: number;
    accessFrecencyScore?: number;
  } | null | undefined) => string;
  globalIteratorStore: IteratorStore;
  storeIterator: <T>(store: IteratorStore, scopeId: string, namespace: string, value: T) => string;
  consumeIterator: <T>(store: IteratorStore, id: string) => T | undefined;
}

export const defaultDeps: CoordinatorDeps = {
  createFinder,
  getCachedFinder,
  buildQuery,
  resolveFuzzySearchPath,
  formatGrepOutput,
  fileAnnotation,
  globalIteratorStore,
  storeIterator,
  consumeIterator,
};

export function resolveStore(opts: import('./types.js').SearchOptions): IteratorStore {
  return opts.store ?? globalIteratorStore;
}
