import type { PluginInput } from '@opencode-ai/plugin';
import type { NudgeShellState } from 'engine/nudge-shell';
import {
  addRetryPendingSession,
  deleteNudgedSession,
  deleteRetryPendingSession,
  stopSession,
} from 'engine/nudge-shell';
import type { ReviewStore } from 'engine/review';
import { isAbortEventError } from 'engine/util';
import { nudgeIfNeeded } from '../timing';

export async function handleSessionIdle(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
  ctx: PluginInput,
  reviewStore: ReviewStore,
): Promise<NudgeShellState> {
  return nudgeIfNeeded(state, ctx, sessionID, reviewStore);
}

export function handleSessionBusy(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
  _ctx: PluginInput,
): NudgeShellState {
  if (sessionID !== state.lastNudgedSession)
    state = deleteNudgedSession(state, sessionID);
  return { ...state, lastNudgedSession: null };
}

export function handleSessionError(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  const error = props.error as { name?: string } | undefined;
  if (isAbortEventError(error)) return stopSession(state, sessionID);
  return addRetryPendingSession(state, sessionID);
}

export function handleSessionRetryStatus(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  return addRetryPendingSession(state, sessionID);
}

export function handleRetryProgress(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  return deleteRetryPendingSession(state, sessionID);
}
