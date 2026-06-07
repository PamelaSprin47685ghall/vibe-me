import { findCapsFiles } from "engine/caps"

export interface CapsFileReadEntry {
  path: string
  callId: string
  input: { path: string }
  output: {
    success: true
    file_size: number
    modifiedTime: string
    lines_read: number
    content: string
  }
}

export async function buildCapsFileReadData(projectRoot: string): Promise<CapsFileReadEntry[]> {
  const files = await findCapsFiles(projectRoot)
  if (!files.length) return []

  const timestamp = Date.now()

  return files.map(({ filePath, content }, index) => ({
    path: filePath,
    callId: `caps-fr-${timestamp}-${index}`,
    input: { path: filePath },
    output: {
      success: true,
      file_size: content.length,
      modifiedTime: new Date().toISOString(),
      lines_read: content.split("\n").length,
      content: content
        .split("\n")
        .map((line, i) => `${i + 1}\t${line}`)
        .join("\n"),
    },
  }))
}
