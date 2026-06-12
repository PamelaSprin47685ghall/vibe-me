import type { PluginInput } from '@opencode-ai/plugin';
import { defaultCoordinator } from 'engine/todo';
import { cleanupRegistry, globalJobRegistry } from 'engine/runner';
import {
  resumeSession,
  stopSession,
  clearSession,
  addRetryPendingSession,
  deleteRetryPendingSession,
  deleteNudgedSession,
} from 'engine/nudge-shell';
import type { NudgeShellState } from 'engine/nudge-shell';
import { nudgeIfNeeded } from './timing';
import {
  isAbortEventError,
  isNudgePrompt,
  isRetryProgressEvent,
  isRetryProgressPart,
  isCompletedAssistantMessage,
  isTerminalAssistantFinish,
} from 'engine/util';

export type EventHandler = (
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
  ctx: PluginInput,
) => NudgeShellState | Promise<NudgeShellState>;

function handleSessionDelete(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string): NudgeShellState {
  cleanupRegistry(globalJobRegistry, sessionID);
  defaultCoordinator.clearSession(sessionID);
  return clearSession(state, sessionID);
}

function handleSessionNextPrompted(state: NudgeShellState, props: Record<string, unknown>, sessionID: string): NudgeShellState {
  const text = (props.prompt as { text?: unknown } | undefined)?.text;
  if (!isNudgePrompt(text)) state = resumeSession(state, sessionID);
  return state;
}

function handleSessionNextRetried(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string): NudgeShellState {
  return addRetryPendingSession(state, sessionID);
}

function handleMessageUpdated(state: NudgeShellState, props: Record<string, unknown>, sessionID: string, ctx: PluginInput): Promise<NudgeShellState> {
  const info = props.info as { error?: unknown } | undefined;
  if (isAbortEventError(info?.error)) return Promise.resolve(stopSession(state, sessionID));
  if (isCompletedAssistantMessage(info)) return nudgeIfNeeded(state, ctx, sessionID);
  return Promise.resolve(state);
}

function handleMessagePartUpdated(state: NudgeShellState, props: Record<string, unknown>, sessionID: string): NudgeShellState {
  const part = props.part as { type?: unknown; state?: unknown; error?: unknown } | undefined;
  if (part?.type === 'retry') return addRetryPendingSession(state, sessionID);
  if (isAbortEventError(part?.error) || isAbortEventError(part?.state)) return stopSession(state, sessionID);
  if (isRetryProgressPart(part?.type)) return deleteRetryPendingSession(state, sessionID);
  return state;
}

function handleSessionNextStepFailed(state: NudgeShellState, props: Record<string, unknown>, sessionID: string): NudgeShellState {
  if (isAbortEventError(props.error)) return stopSession(state, sessionID);
  return state;
}

function handleSessionNextToolFailed(state: NudgeShellState, props: Record<string, unknown>, sessionID: string): NudgeShellState {
  if (isAbortEventError(props.error)) return stopSession(state, sessionID);
  return deleteRetryPendingSession(state, sessionID);
}

async function handleSessionNextStepEnded(state: NudgeShellState, props: Record<string, unknown>, sessionID: string, ctx: PluginInput): Promise<NudgeShellState> {
  state = deleteRetryPendingSession(state, sessionID);
  if (isTerminalAssistantFinish(props.finish)) state = await nudgeIfNeeded(state, ctx, sessionID);
  return state;
}

async function handleSessionIdle(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string, ctx: PluginInput): Promise<NudgeShellState> {
  return nudgeIfNeeded(state, ctx, sessionID);
}

function handleSessionBusy(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string, _ctx: PluginInput): NudgeShellState {
  if (sessionID !== state.lastNudgedSession) state = deleteNudgedSession(state, sessionID);
  return { ...state, lastNudgedSession: null };
}

function handleSessionError(state: NudgeShellState, props: Record<string, unknown>, sessionID: string): NudgeShellState {
  const error = props.error as { name?: string } | undefined;
  if (isAbortEventError(error)) return stopSession(state, sessionID);
  return addRetryPendingSession(state, sessionID);
}

function handleSessionRetryStatus(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string): NudgeShellState {
  return addRetryPendingSession(state, sessionID);
}

function handleRetryProgress(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string): NudgeShellState {
  return deleteRetryPendingSession(state, sessionID);
}

export function createEventHandlers(ctx: PluginInput): Record<string, EventHandler> {
  return {
    'session.delete': handleSessionDelete,
    'session.close': handleSessionDelete,
    'session.remove': handleSessionDelete,
    'session.deleted': handleSessionDelete,
    'session.next.prompted': handleSessionNextPrompted,
    'session.next.retried': handleSessionNextRetried,
    'message.updated': handleMessageUpdated,
    'message.part.updated': handleMessagePartUpdated,
    'session.next.step.failed': handleSessionNextStepFailed,
    'session.next.tool.failed': handleSessionNextToolFailed,
    'session.next.step.ended': handleSessionNextStepEnded,
    'session.idle': handleSessionIdle,
    'session.error': handleSessionError,
  };
}

export function matchCompositeHandler(
  eventType: string,
  statusType: string | undefined,
): EventHandler | null {
  if (eventType === 'session.status' && statusType === 'retry') return handleSessionRetryStatus;
  if (eventType === 'session.status' && statusType === 'idle') return handleSessionIdle;
  if (eventType === 'session.status' && statusType === 'busy') return handleSessionBusy;
  if (isRetryProgressEvent(eventType)) return handleRetryProgress;
  return null;
}