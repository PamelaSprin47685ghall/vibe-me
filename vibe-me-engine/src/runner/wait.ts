import { cleanupJob, truncateTail } from './jobs.js';
import { MAX_OUTPUT_BYTES } from './job.js';
import { evaluateWait } from './state.js';
import type { WaitOptions, WaitResult } from './types.js';

const HUNG_WARNING =
  '[System] Task still running. No new output during this wait.\n' +
  '⚠️ Risk warning: Output stream is silent. This strongly suggests the process may be hung ' +
  'or stuck in an infinite loop. Evaluate the last few lines of output carefully.\n' +
  'Unless you are sure it is doing heavy background computation, continued waiting is usually pointless. ' +
  'The wise choice is to call abort() and redesign a more robust command.';

export async function wait(options: WaitOptions): Promise<WaitResult> {
  const { jobs, sessionId, ms } = options;
  const entry = jobs.get(sessionId);
  if (!entry) return { output: '', completed: true, message: '[System] No active job — it has already finished or was cleaned up.' };

  const { state } = entry.record;
  if (state._tag === 'Completed' || state._tag === 'Aborted') {
    const output = truncateTail(state.output, MAX_OUTPUT_BYTES);
    cleanupJob(jobs, sessionId);
    return { output, completed: true, message: state._tag === 'Completed' ? '[System] Task has completed.' : '[System] Task was aborted.' };
  }

  await Promise.race([entry.handles.closePromise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

  const { result, nextState } = evaluateWait(entry.record.state);
  entry.record = { ...entry.record, state: nextState };

  switch (result._tag) {
    case 'Completed':
    case 'Aborted': {
      const output = truncateTail(result.output, MAX_OUTPUT_BYTES);
      cleanupJob(jobs, sessionId);
      return { output, completed: true, message: result._tag === 'Completed' ? '[System] Task has completed.' : '[System] Task was aborted.' };
    }
    case 'StillRunning': {
      if (!result.output) return { output: '', completed: false, message: HUNG_WARNING };
      return { output: truncateTail(result.output, MAX_OUTPUT_BYTES), completed: false, message: '[System] Task still running in background.' };
    }
  }
}