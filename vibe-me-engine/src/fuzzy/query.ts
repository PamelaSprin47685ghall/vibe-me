import path from 'node:path';

export interface ResolvedFuzzySearchPath {
  basePath: string;
  pathConstraint: string | null;
  external: boolean;
}

function normalizeRelativePath(fromPath: string, toPath: string): string {
  return path.relative(fromPath, toPath).replaceAll(path.sep, '/');
}

function isPathOutside(basePath: string, targetPath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

export function resolveFuzzySearchPath(
  inputPath: string | undefined | null,
  cwd = process.cwd(),
): ResolvedFuzzySearchPath {
  const basePath = path.resolve(cwd);
  const trimmedPath = inputPath?.trim();
  if (!trimmedPath) return { basePath, pathConstraint: null, external: false };

  const resolvedPath = path.resolve(basePath, trimmedPath);
  if (path.isAbsolute(trimmedPath) || isPathOutside(basePath, resolvedPath)) {
    const externalPath = resolveExternalBasePath(resolvedPath);
    return { basePath: externalPath.basePath, pathConstraint: externalPath.pathConstraint, external: true };
  }

  return { basePath, pathConstraint: normalizeRelativePath(basePath, resolvedPath) || null, external: false };
}

export function normalizePathConstraint(
  pathConstraint: string,
  cwd = process.cwd(),
): string | null {
  let trimmed = pathConstraint.trim();
  if (!trimmed) return null;

  if (path.isAbsolute(trimmed)) {
    const relative = path.relative(cwd, trimmed).replaceAll(path.sep, '/');
    if (relative === '') return null;
    if (relative.startsWith('../') || relative === '..' || path.isAbsolute(relative)) return null;
    trimmed = relative;
  }

  if (trimmed === '.' || trimmed === './') return null;
  if (trimmed.startsWith('./')) trimmed = trimmed.slice(2);

  const recursiveDir = /^(.*)\/\*\*(?:\/\*)?$/.exec(trimmed);
  if (recursiveDir) {
    const dir = recursiveDir[1];
    if (dir && !/[*?[{]/.test(dir)) return `${dir}/`;
  }

  if (trimmed.startsWith('/') || trimmed.endsWith('/')) return trimmed;
  if (/[*?[{]/.test(trimmed)) return trimmed;
  const lastSegment = trimmed.split('/').pop() ?? '';
  if (/\.[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(lastSegment)) return trimmed;
  return `${trimmed}/`;
}

export function normalizeExcludes(
  exclude: string | string[] | undefined | null,
  cwd = process.cwd(),
): string[] {
  if (!exclude) return [];
  const list = Array.isArray(exclude) ? exclude : [exclude];
  const out: string[] = [];
  for (const raw of list) {
    for (const p of raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)) {
      const stripped = p.startsWith('!') ? p.slice(1) : p;
      const normalized = normalizePathConstraint(stripped, cwd);
      if (normalized) out.push(`!${normalized}`);
    }
  }
  return out;
}

export function buildQuery(
  fpath: string | undefined | null,
  pattern: string,
  exclude: string | string[] | undefined | null,
  cwd = process.cwd(),
  allowExternal = false,
): string {
  const parts: string[] = [];
  if (fpath) {
    if (allowExternal && path.isAbsolute(fpath)) {
      parts.push(fpath);
    } else {
      const pathConstraint = normalizePathConstraint(fpath, cwd);
      if (pathConstraint) parts.push(pathConstraint);
    }
  }
  parts.push(...normalizeExcludes(exclude, cwd));
  parts.push(pattern);
  return parts.join(' ');
}

export function resolveExternalPath(
  inputPath: string | undefined | null,
  cwd = process.cwd(),
): { externalBasePath: string | null; externalPathConstraint: string | null } {
  const searchPath = resolveFuzzySearchPath(inputPath, cwd);
  if (!searchPath.external) return { externalBasePath: null, externalPathConstraint: null };
  return {
    externalBasePath: searchPath.basePath,
    externalPathConstraint: searchPath.pathConstraint,
  };
}

export function resolveExternalBasePath(absPath: string): {
  basePath: string;
  pathConstraint: string | null;
} {
  const normalized = path.resolve(absPath);
  const lastSegment = normalized.split(path.sep).pop() ?? '';
  if (lastSegment.startsWith('.') || /\.[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(lastSegment)) {
    return { basePath: path.dirname(normalized), pathConstraint: lastSegment };
  }
  return { basePath: normalized, pathConstraint: null };
}
