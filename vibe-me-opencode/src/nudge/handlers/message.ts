import type { PluginInput } from '@opencode-ai/plugin';
import type { NudgeShellState } from 'engine/nudge-shell';
import {
  addRetryPendingSession,
  deleteRetryPendingSession,
  stopSession,
} from 'engine/nudge-shell';
import type { ReviewStore } from 'engine/review';
import {
  isAbortEventError,
  isCompletedAssistantMessage,
  isRetryProgressPart,
} from 'engine/util';
import { nudgeIfNeeded } from '../timing';

export async function handleMessageUpdated(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
  ctx: PluginInput,
  reviewStore: ReviewStore,
): Promise<NudgeShellState> {
  const info = props.info as { error?: unknown } | undefined;
  if (isAbortEventError(info?.error)) return stopSession(state, sessionID);
  if (isCompletedAssistantMessage(info))
    return nudgeIfNeeded(state, ctx, sessionID, reviewStore);
  return state;
}

export function handleMessagePartUpdated(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  const part = props.part as
    | { type?: unknown; state?: unknown; error?: unknown }
    | undefined;
  if (part?.type === 'retry') return addRetryPendingSession(state, sessionID);
  if (isAbortEventError(part?.error) || isAbortEventError(part?.state))
    return stopSession(state, sessionID);
  if (isRetryProgressPart(part?.type))
    return deleteRetryPendingSession(state, sessionID);
  return state;
}
