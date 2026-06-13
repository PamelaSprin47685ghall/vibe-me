import { ok, err, type Result } from '../types/general.js';
import type { FinderLike } from './coordinator/types.js';

type FffModule = typeof import('@ff-labs/fff-node');

const importModuleAtRuntime = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<FffModule>;

export async function createFinder(basePath: string): Promise<Result<FinderLike, string>> {
  const { FileFinder } = await importModuleAtRuntime('@ff-labs/fff-node');
  const result = FileFinder.create({ basePath, aiMode: true });
  if (!result.ok) return err(result.error);
  const finder = result.value;
  try { await finder.waitForScan(15000); } catch { /* scan timeout non-fatal */ }
  return ok(finder);
}
