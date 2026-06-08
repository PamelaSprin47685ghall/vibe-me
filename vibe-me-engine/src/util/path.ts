import path from "node:path";

export const isWithinDirectory = (child: string, parent: string): boolean => {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
};
