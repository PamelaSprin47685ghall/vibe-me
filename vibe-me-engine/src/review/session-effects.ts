import type { AbortSuppressor } from '../util/abort.js';
import type { ReviewResult } from './session-node.js';

export interface SessionEffects {
  readonly pendingResolutions: Map<string, (result: ReviewResult) => void>;
  readonly abortSuppressors: Map<string, AbortSuppressor>;
}

export function emptyEffects(): SessionEffects {
  return {
    pendingResolutions: new Map(),
    abortSuppressors: new Map(),
  };
}

export function resolvePending(
  effects: SessionEffects,
  sessionId: string,
  result: ReviewResult,
): boolean {
  const resolve = effects.pendingResolutions.get(sessionId);
  if (!resolve) return false;
  resolve(result);
  effects.pendingResolutions.delete(sessionId);
  const suppressor = effects.abortSuppressors.get(sessionId);
  suppressor?.restore();
  effects.abortSuppressors.delete(sessionId);
  return true;
}

export function disposeSessionTree(
  effects: SessionEffects,
  sessionIds: Iterable<string>,
): void {
  const terminated: ReviewResult = { accepted: false, terminated: true };
  for (const id of sessionIds) {
    const resolve = effects.pendingResolutions.get(id);
    if (resolve) {
      resolve(terminated);
      effects.pendingResolutions.delete(id);
    }
    const suppressor = effects.abortSuppressors.get(id);
    suppressor?.restore();
    effects.abortSuppressors.delete(id);
  }
}