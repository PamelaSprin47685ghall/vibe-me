import type { PluginInput } from '@opencode-ai/plugin';
import type { NudgeShellState } from 'engine/nudge-shell';
import { deleteRetryPendingSession, stopSession } from 'engine/nudge-shell';
import type { ReviewStore } from 'engine/review';
import { isAbortEventError, isTerminalAssistantFinish } from 'engine/util';
import { nudgeIfNeeded } from '../timing';

export function handleSessionNextStepFailed(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  if (isAbortEventError(props.error)) return stopSession(state, sessionID);
  return state;
}

export function handleSessionNextToolFailed(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  if (isAbortEventError(props.error)) return stopSession(state, sessionID);
  return deleteRetryPendingSession(state, sessionID);
}

export async function handleSessionNextStepEnded(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
  ctx: PluginInput,
  reviewStore: ReviewStore,
): Promise<NudgeShellState> {
  state = deleteRetryPendingSession(state, sessionID);
  if (isTerminalAssistantFinish(props.finish))
    state = await nudgeIfNeeded(state, ctx, sessionID, reviewStore);
  return state;
}
