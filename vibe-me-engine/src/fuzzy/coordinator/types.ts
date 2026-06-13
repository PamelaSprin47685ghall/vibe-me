import type { GrepCursor, GrepOptions } from '@ff-labs/fff-node';
import type { IteratorStore } from '../../util/iterator.js';
import type { FindResultLike, GrepResultLike } from '../format.js';

export interface FuzzyFindParams {
  pattern?: string;
  path?: string;
  limit?: number;
  iterator?: string;
}

export interface FuzzyGrepParams {
  pattern?: string;
  path?: string;
  exclude?: string | string[];
  caseSensitive?: boolean;
  context?: number;
  limit?: number;
  iterator?: string;
}

export interface SearchOptions {
  cwd: string;
  scopeId: string;
  store?: IteratorStore;
}

export interface FuzzyFindState {
  query: string;
  pageSize: number;
  pageIndex: number;
  externalBasePath: string | null;
}

export interface FuzzyGrepState {
  query: string;
  mode: 'plain' | 'regex' | 'fuzzy';
  smartCase: boolean;
  beforeContext: number;
  afterContext: number;
  pageSize: number;
  externalBasePath: string | null;
  cursor: GrepCursor | null;
}

export type FinderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface FinderLike {
  fileSearch(query: string, options: { pageIndex: number; pageSize: number }): FinderResult<FindResultLike>;
  grep(query: string, options: GrepOptions): FinderResult<GrepResultLike>;
  destroy(): void;
}
