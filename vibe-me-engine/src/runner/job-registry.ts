import type { JobRecord } from './job-data.js';
import type { JobHandles } from './job-effects.js';
import { releaseHandles, cleanupFiles } from './job-effects.js';
import { transition } from './state.js';
import { exitEvent } from '../types/runner/event.js';

export interface JobEntry {
  record: JobRecord;
  handles: JobHandles;
}

export type JobRegistry = Map<string, JobEntry>;

export function createJobRegistry(): JobRegistry {
  return new Map();
}

function disposeEntry(entry: JobEntry): void {
  if (entry.record.state._tag === 'Running') {
    entry.record = { ...entry.record, state: transition(entry.record.state, exitEvent(null)) };
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