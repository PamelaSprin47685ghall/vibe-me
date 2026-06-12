import type { PluginInput } from '@opencode-ai/plugin';
import { defaultCoordinator } from 'engine/todo';
import type { ReviewStore } from 'engine/review';
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
  reviewStore: ReviewStore,
) => NudgeShellState | Promise<NudgeShellState>;

function handleSessionDelete(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string): NudgeShellState {
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

function handleMessageUpdated(state: NudgeShellState, props: Record<string, unknown>, sessionID: string, ctx: PluginInput, reviewStore: ReviewStore): Promise<NudgeShellState> {
  const info = props.info as { error?: unknown } | undefined;
  if (isAbortEventError(info?.error)) return Promise.resolve(stopSession(state, sessionID));
  if (isCompletedAssistantMessage(info)) return nudgeIfNeeded(state, ctx, sessionID, reviewStore);
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

async function handleSessionNextStepEnded(state: NudgeShellState, props: Record<string, unknown>, sessionID: string, ctx: PluginInput, reviewStore: ReviewStore): Promise<NudgeShellState> {
  state = deleteRetryPendingSession(state, sessionID);
  if (isTerminalAssistantFinish(props.finish)) state = await nudgeIfNeeded(state, ctx, sessionID, reviewStore);
  return state;
}

async function handleSessionIdle(state: NudgeShellState, _props: Record<string, unknown>, sessionID: string, ctx: PluginInput, reviewStore: ReviewStore): Promise<NudgeShellState> {
  return nudgeIfNeeded(state, ctx, sessionID, reviewStore);
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

export function createEventHandlers(ctx: PluginInput, reviewStore: ReviewStore): Record<string, EventHandler> {
  return {
    'session.delete': handleSessionDelete as EventHandler,
    'session.close': handleSessionDelete as EventHandler,
    'session.remove': handleSessionDelete as EventHandler,
    'session.deleted': handleSessionDelete as EventHandler,
    'session.next.prompted': handleSessionNextPrompted as EventHandler,
    'session.next.retried': handleSessionNextRetried as EventHandler,
    'message.updated': handleMessageUpdated,
    'message.part.updated': handleMessagePartUpdated as EventHandler,
    'session.next.step.failed': handleSessionNextStepFailed as EventHandler,
    'session.next.tool.failed': handleSessionNextToolFailed as EventHandler,
    'session.next.step.ended': handleSessionNextStepEnded,
    'session.idle': handleSessionIdle,
    'session.error': handleSessionError as EventHandler,
  };
}

export function matchCompositeHandler(
  eventType: string,
  statusType: string | undefined,
): EventHandler | null {
  if (eventType === 'session.status' && statusType === 'retry') return handleSessionRetryStatus as EventHandler;
  if (eventType === 'session.status' && statusType === 'idle') return handleSessionIdle;
  if (eventType === 'session.status' && statusType === 'busy') return handleSessionBusy as EventHandler;
  if (isRetryProgressEvent(eventType)) return handleRetryProgress as EventHandler;
  return null;
}
