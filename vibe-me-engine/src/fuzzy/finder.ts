import type { FileFinder } from '@ff-labs/fff-node';

type FffModule = typeof import('@ff-labs/fff-node');

// Function constructor hides the dynamic import() from the CJS bundler so the
// native ESM import is preserved at runtime (avoids require() rewrites of
// ESM-only packages).
const importModuleAtRuntime = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<FffModule>;

let fffModule: FffModule | null = null;

export async function getFffModule(): Promise<FffModule> {
  fffModule ??= await importModuleAtRuntime('@ff-labs/fff-node');
  return fffModule;
}

async function createFinder(basePath: string): Promise<FileFinder> {
  const { FileFinder } = await getFffModule();
  const result = FileFinder.create({ basePath, aiMode: true });
  if (!result.ok) {
    throw new Error(`Failed to create FFF file finder: ${(result as { error: string }).error}`);
  }
  const finder = result.value;
  try {
    await finder.waitForScan(15000);
  } catch {
    // scan timeout is non-fatal — results still work
  }
  return finder;
}

/**
 * FinderManager — Lazy singleton manager for FileFinder instances.
 *
 * One FileFinder per cwd, cached and destroyed on shutdown.
 * All creation/destruction is handled automatically — no explicit lifecycle needed.
 */
export class FinderManager {
  private static instances = new Map<string, FileFinder>();
  private static pending = new Map<string, Promise<FileFinder>>();

  static async get(cwd: string): Promise<FileFinder> {
    const existing = FinderManager.instances.get(cwd);
    if (existing && !existing.isDestroyed) return existing;

    const pending = FinderManager.pending.get(cwd);
    if (pending) return pending;

    const promise = createFinder(cwd);
    FinderManager.pending.set(cwd, promise);
    try {
      const finder = await promise;
      FinderManager.instances.set(cwd, finder);
      return finder;
    } finally {
      FinderManager.pending.delete(cwd);
    }
  }

  static destroy(cwd: string): void {
    const finder = FinderManager.instances.get(cwd);
    if (finder && !finder.isDestroyed) {
      try {
        finder.destroy();
      } catch {
        // best-effort
      }
    }
    FinderManager.instances.delete(cwd);
    FinderManager.pending.delete(cwd);
  }

  static destroyAll(): void {
    for (const cwd of FinderManager.instances.keys()) FinderManager.destroy(cwd);
  }
}

/**
 * One-off external finder (outside the cached cwd).
 * Caller is responsible for invoking `.destroy()` when done.
 */
export async function createExternalFinder(basePath: string): Promise<FileFinder> {
  return createFinder(basePath);
}
