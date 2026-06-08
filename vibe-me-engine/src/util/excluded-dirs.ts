export const EXCLUDED_DIR_NAMES: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  "__pycache__",
  ".ds_store",
  "target",
  "dist",
  "out",
  ".venv",
  "venv",
  ".cache",
  ".next",
  ".turbo",
  ".parcel-cache",
]);

export const isExcludedDir = (name: string): boolean =>
  EXCLUDED_DIR_NAMES.has(name.toLowerCase());
