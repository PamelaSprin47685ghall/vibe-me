import { type ReviewResult, terminated } from './session-node.js';

export interface SessionEffects {
  readonly pendingResolutions: Map<string, (result: ReviewResult) => void>;
  readonly abortSuppressors: Map<string, () => void>;
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
  suppressor?.();
  effects.abortSuppressors.delete(sessionId);
  return true;
}

export function disposeSessionTree(
  effects: SessionEffects,
  sessionIds: Iterable<string>,
): void {
  for (const id of sessionIds) {
    const resolve = effects.pendingResolutions.get(id);
    if (resolve) {
      resolve(terminated);
      effects.pendingResolutions.delete(id);
    }
    const suppressor = effects.abortSuppressors.get(id);
    suppressor?.();
    effects.abortSuppressors.delete(id);
  }
}