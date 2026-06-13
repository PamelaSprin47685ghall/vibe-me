import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewResult } from 'engine/review';
import type { promptWithAbort } from '../../utils/abort-signal';
import type { Deferred } from '../types';
import {
  cleanupRoundAbortController,
  prepareRoundAbortController,
} from './abort.js';
import { resolveRacedOutcome } from './outcome.js';
import { runPromptRound } from './prompt.js';
import type { Clock, PromptRaceResult } from './types.js';

export async function runOneRound(
  client: PluginInput['client'],
  childID: string,
  nudgeCount: number,
  parts: Array<{ type: 'text'; text: string }>,
  abortSignal: AbortSignal | undefined,
  deferred: Deferred<ReviewResult>,
  promptFn: typeof promptWithAbort,
  clock: Clock,
  graceMs: number,
): Promise<import('engine/review').ReviewerRoundOutcome> {
  const { controller, cleanup } = prepareRoundAbortController(abortSignal);

  try {
    const raced = await runPromptRound(
      client,
      childID,
      nudgeCount,
      parts,
      controller.signal,
      promptFn,
      deferred,
    );

    return await resolveRacedOutcome(
      raced as PromptRaceResult,
      deferred,
      clock,
      graceMs,
      controller.signal,
    );
  } finally {
    cleanupRoundAbortController(cleanup, controller);
  }
}
