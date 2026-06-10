import type { PluginInput } from '@opencode-ai/plugin';
import {
  abort,
  buildRunnerNudgePrompt,
  cleanupJob,
  hasActiveJob,
} from 'engine/runner';
import { promptWithAbort } from '../utils/abort-signal';
import { managedRunnerSessions } from './execute';

const MAX_RUNNER_NUDGES = 10;

export async function runNudgeLoop(
  client: PluginInput['client'],
  childID: string,
  abortSignal: AbortSignal | undefined,
): Promise<string | null> {
  managedRunnerSessions.add(childID);
  try {
    let nudgeCount = 0;
    while (hasActiveJob(childID) && nudgeCount < MAX_RUNNER_NUDGES) {
      await promptWithAbort(
        client,
        {
          path: { id: childID },
          body: {
            agent: 'runner',
            parts: [{ type: 'text', text: buildRunnerNudgePrompt() }],
          },
        },
        abortSignal,
      );
      nudgeCount++;
    }

    if (hasActiveJob(childID)) {
      abort(childID);
      cleanupJob(childID);
      return 'Runner did not respond after multiple attempts. The background task has been aborted.';
    }
    return null;
  } finally {
    managedRunnerSessions.delete(childID);
  }
}