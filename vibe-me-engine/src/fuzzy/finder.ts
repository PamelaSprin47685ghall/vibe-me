import type { FileFinder } from '@ff-labs/fff-node';

type FffModule = typeof import('@ff-labs/fff-node');

const importModuleAtRuntime = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<FffModule>;

let fffModule: FffModule | null = null;

export async function getFffModule(): Promise<FffModule> {
  fffModule ??= await importModuleAtRuntime('@ff-labs/fff-node');
  return fffModule;
}

export async function createFinder(basePath: string): Promise<FileFinder> {
  const { FileFinder } = await getFffModule();
  const result = FileFinder.create({ basePath, aiMode: true });
  if (!result.ok) throw new Error(`Failed to create FFF file finder: ${(result as { error: string }).error}`);
  const finder = result.value;
  try { await finder.waitForScan(15000); } catch { /* scan timeout non-fatal */ }
  return finder;
}