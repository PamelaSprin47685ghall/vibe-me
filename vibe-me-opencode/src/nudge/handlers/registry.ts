import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import { isRetryProgressEvent } from 'engine/util';
import { handleMessagePartUpdated, handleMessageUpdated } from './message.js';
import {
  handleSessionDelete,
  handleSessionNextPrompted,
  handleSessionNextRetried,
} from './session.js';
import {
  handleRetryProgress,
  handleSessionBusy,
  handleSessionError,
  handleSessionIdle,
  handleSessionRetryStatus,
} from './status.js';
import {
  handleSessionNextStepEnded,
  handleSessionNextStepFailed,
  handleSessionNextToolFailed,
} from './step.js';
import type { EventHandler } from './types.js';

export function createEventHandlers(
  _ctx: PluginInput,
  _reviewStore: ReviewStore,
): Record<string, EventHandler> {
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
  if (eventType === 'session.status' && statusType === 'retry')
    return handleSessionRetryStatus as EventHandler;
  if (eventType === 'session.status' && statusType === 'idle')
    return handleSessionIdle;
  if (eventType === 'session.status' && statusType === 'busy')
    return handleSessionBusy as EventHandler;
  if (isRetryProgressEvent(eventType))
    return handleRetryProgress as EventHandler;
  return null;
}
