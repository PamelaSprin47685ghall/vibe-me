import { cleanupJob, truncateTail } from './jobs.js';
import { globalJobRegistry, MAX_OUTPUT_BYTES } from './job.js';
import type { WaitOptions, WaitResult } from './types.js';

export async function wait(options: WaitOptions): Promise<WaitResult> {
  const { sessionId, ms } = options;
  const entry = globalJobRegistry.get(sessionId);
  if (!entry) return { output: '', completed: true, message: '[System] No active job — it has already finished or was cleaned up.' };

  const { record } = entry;
  if (record.status === 'completed' || record.status === 'aborted') {
    const newOutput = truncateTail(record.finalOutput.substring(record.bytesRead), MAX_OUTPUT_BYTES).trim();
    cleanupJob(sessionId);
    return {
      output: newOutput, completed: true,
      message: record.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.',
    };
  }

  await Promise.race([entry.handles.closePromise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  const newOutput = record.finalOutput.substring(record.bytesRead).trim();
  entry.record = { ...record, bytesRead: record.finalOutput.length };

  if (entry.record.status !== 'running') {
    cleanupJob(sessionId);
    return { output: newOutput || '(no new output)', completed: true, message: entry.record.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.' };
  }

  if (!newOutput) {
    return {
      output: '',
      completed: false,
      message:
        '[System] Task still running. No new output during this wait.\n' +
        '⚠️ Risk warning: Output stream is silent. This strongly suggests the process may be hung ' +
        'or stuck in an infinite loop. Evaluate the last few lines of output carefully.\n' +
        'Unless you are sure it is doing heavy background computation, continued waiting is usually pointless. ' +
        'The wise choice is to call abort() and redesign a more robust command.',
    };
  }

  return { output: truncateTail(newOutput, MAX_OUTPUT_BYTES), completed: false, message: '[System] Task still running in background.' };
}