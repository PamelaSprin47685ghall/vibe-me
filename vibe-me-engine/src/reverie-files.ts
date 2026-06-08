import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

const MAX_REVERIE_FILE_BYTES = 1_048_576

export interface ReverieFileResult {
  readonly filePath: string
  readonly content?: string
  readonly skipReason?: 'too-large' | 'not-file' | 'unreadable'
}

export async function readReverieFiles(
  cwd: string,
  files: readonly string[],
): Promise<ReverieFileResult[]> {
  return Promise.all(files.map(async (file): Promise<ReverieFileResult> => {
    const absolute = resolve(cwd, file)

    let stat
    try {
      stat = await fs.stat(absolute)
    } catch {
      return { filePath: file, skipReason: 'unreadable' as const }
    }

    if (!stat.isFile()) {
      return { filePath: file, skipReason: 'not-file' as const }
    }

    if (stat.size > MAX_REVERIE_FILE_BYTES) {
      return { filePath: file, skipReason: 'too-large' as const }
    }

    try {
      const content = await fs.readFile(absolute, 'utf-8')
      return { filePath: absolute, content }
    } catch {
      return { filePath: file, skipReason: 'unreadable' as const }
    }
  }))
}
