import type { JobRegistry } from './job-registry.js';
import { cleanupJob } from './jobs.js';

export function abort(jobs: JobRegistry, sessionId: string): string {
  const job = jobs.get(sessionId);
  if (!job) return 'No active task found to abort.';
  cleanupJob(jobs, sessionId);
  return '[System] Task has been forcefully terminated.';
}
