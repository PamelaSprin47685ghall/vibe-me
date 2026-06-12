import { chmodSync, writeFileSync } from 'node:fs';
import { getExecutorProjectDir } from './paths.js';

export function createTempScript(scriptPath: string, program: string): string {
  writeFileSync(scriptPath, program, 'utf-8');
  if (process.platform !== 'win32') chmodSync(scriptPath, 0o755);
  return scriptPath;
}

export function getTempScriptPath(sessionId: string, extension: string): string {
  return `${getExecutorProjectDir(sessionId)}/script.${extension}`;
}
