import type { JobRecord } from './job-data.js';
import { markAborted } from './job-data.js';
import type { JobHandles } from './job-effects.js';
import { releaseHandles, cleanupFiles } from './job-effects.js';
import { running } from '../types/runner/status.js';

export interface JobEntry {
  record: JobRecord;
  handles: JobHandles;
}

export type JobRegistry = Map<string, JobEntry>;

function disposeEntry(entry: JobEntry): void {
  if (entry.record.status._tag === running._tag) {
    entry.record = markAborted(entry.record);
  }
  releaseHandles(entry.handles);
  cleanupFiles(entry.record);
}

export function cleanupRegistry(registry: JobRegistry, sessionId: string): void {
  const directEntry = registry.get(sessionId);
  if (directEntry) {
    disposeEntry(directEntry);
    registry.delete(sessionId);
    return;
  }
  for (const [id, entry] of registry) {
    if (entry.record.parentSessionId === sessionId) {
      disposeEntry(entry);
      registry.delete(id);
    }
  }
}

export const globalJobRegistry: JobRegistry = new Map();