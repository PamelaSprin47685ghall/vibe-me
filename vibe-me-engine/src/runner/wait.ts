import { cleanupJob, truncateTail } from './jobs.js';
import { globalJobRegistry, MAX_OUTPUT_BYTES } from './job.js';
import type { WaitOptions, WaitResult } from './types.js';

export async function wait(options: WaitOptions): Promise<WaitResult> {
  const { sessionId, ms } = options;
  const job = globalJobRegistry.get(sessionId);
  if (!job) return { output: '', completed: true, message: '[System] No active job — it has already finished or was cleaned up.' };

  if (job.status === 'completed' || job.status === 'aborted') {
    const newOutput = truncateTail(job.finalOutput.substring(job.bytesRead), MAX_OUTPUT_BYTES).trim();
    cleanupJob(sessionId);
    return {
      output: newOutput, completed: true,
      message: job.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.',
    };
  }

  await Promise.race([job.closePromise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  const newOutput = job.finalOutput.substring(job.bytesRead).trim();
  job.bytesRead = job.finalOutput.length;

  if (job.status !== 'running') {
    cleanupJob(sessionId);
    return { output: newOutput || '(no new output)', completed: true, message: job.status === 'completed' ? '[System] Task has completed.' : '[System] Task was aborted.' };
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
