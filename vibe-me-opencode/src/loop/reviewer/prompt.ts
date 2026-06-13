import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewResult } from 'engine/review';
import { REVIEWER_NUDGE_PROMPT, reviewerPromptParts } from 'engine/review';
import type { promptWithAbort } from '../../utils/abort-signal';
import type { Deferred } from '../types';
import type { PromptRaceResult } from './types.js';

export async function runPromptRound(
  client: PluginInput['client'],
  childID: string,
  nudgeCount: number,
  parts: Array<{ type: 'text'; text: string }>,
  iterAbort: AbortSignal,
  promptFn: typeof promptWithAbort,
  deferred: Deferred<ReviewResult>,
): Promise<PromptRaceResult> {
  const roundParts = reviewerPromptParts(
    nudgeCount,
    parts,
    REVIEWER_NUDGE_PROMPT,
  );

  const promptPromise = promptFn(
    client,
    {
      path: { id: childID },
      body: {
        agent: 'reviewer',
        parts: roundParts,
        tools: { submit_review_result: true },
      },
    },
    iterAbort,
  )
    .then(() => ({ type: 'prompt_done' as const }))
    .catch((error: unknown) => ({ type: 'error' as const, error }));

  return Promise.race([
    deferred.promise.then((result) => ({ type: 'result' as const, result })),
    promptPromise,
  ]);
}
