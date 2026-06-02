import { checkSyntax } from './checker.js';
import { readFile } from 'node:fs/promises';

export function withSyntaxCheck<T extends (...args: any[]) => Promise<string>>(
  fn: T,
  extractPath: (args: Parameters<T>) => string | undefined
): T {
  return (async (...args: Parameters<T>) => {
    const output = await fn(...args);
    
    if (output.includes('[syntax-check]')) return output;

    const path = extractPath(args);
    if (!path || !path.match(/\.(ts|js|tsx|jsx|py|rs|go|c|cpp|java)$/)) return output;

    try {
      const content = await readFile(path, 'utf-8');
      const result = await checkSyntax(path, content);
      
      if (result.errors.length === 0) return output;
      
      const diagnostics = result.errors
        .map(e => `  Line ${e.startPosition.row + 1}: ${e.message}`)
        .join('\n');
      
      return `${output}\n\n[syntax-check]\n${diagnostics}`;
    } catch {
      return output;
    }
  }) as T;
}
