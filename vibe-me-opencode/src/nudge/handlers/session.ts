import type { NudgeShellState } from 'engine/nudge-shell';
import {
  addRetryPendingSession,
  clearSession,
  resumeSession,
} from 'engine/nudge-shell';
import { defaultCoordinator } from 'engine/todo';
import { isNudgePrompt } from 'engine/util';

export function handleSessionDelete(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  defaultCoordinator.clearSession(sessionID);
  return clearSession(state, sessionID);
}

export function handleSessionNextPrompted(
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  const text = (props.prompt as { text?: unknown } | undefined)?.text;
  if (!isNudgePrompt(text)) state = resumeSession(state, sessionID);
  return state;
}

export function handleSessionNextRetried(
  state: NudgeShellState,
  _props: Record<string, unknown>,
  sessionID: string,
): NudgeShellState {
  return addRetryPendingSession(state, sessionID);
}
