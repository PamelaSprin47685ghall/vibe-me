import { cleanupJob } from './jobs.js';
import { globalJobRegistry } from './job.js';

export function abort(sessionId: string): string {
  const job = globalJobRegistry.get(sessionId);
  if (!job) return 'No active task found to abort.';
  cleanupJob(sessionId);
  return '[System] Task has been forcefully terminated.';
}
