import {
  type ReviewState,
  type ReviewCommand,
  activateCommand,
  lockCommand,
  unlockCommand,
  acceptCommand,
  rejectCommand,
} from '../types/review.js';
import { transition, isActive as isActiveState } from './state.js';
import { type ReviewSession, emptySession, applyCommand, withTask, withFeedback, addChild } from './session-node.js';

export type { ReviewSession, ReviewResult, Accepted, Rejected, Terminated } from './session-node.js';
export { accepted, rejected, terminated, matchReviewResult } from './session-node.js';

export type RegistryAction =
  | { readonly type: 'activate'; readonly id: string; readonly task: string; readonly createdAt: number }
  | { readonly type: 'deactivate'; readonly id: string }
  | { readonly type: 'evict'; readonly cutoff: number }
  | { readonly type: 'lock'; readonly id: string; readonly reviewerId: string }
  | { readonly type: 'unlock'; readonly id: string }
  | { readonly type: 'accept'; readonly id: string }
  | { readonly type: 'reject'; readonly id: string; readonly feedback: string }
  | { readonly type: 'setFeedback'; readonly id: string; readonly feedback: string | null }
  | { readonly type: 'addChild'; readonly parentId: string; readonly childId: string }
  | { readonly type: 'clear' };

export type SessionRegistry = ReadonlyMap<string, ReviewSession>;

export function emptyRegistry(): SessionRegistry { return new Map(); }

export function reduce(registry: SessionRegistry, action: RegistryAction): SessionRegistry {
  switch (action.type) {
    case 'activate': {
      const cur = registry.get(action.id) ?? withTask(emptySession(action.id, action.createdAt), action.task);
      return set(registry, action.id, applyCommand(withTask(cur, action.task), activateCommand(action.task)));
    }
    case 'lock': return transitionIn(registry, action.id, lockCommand(action.reviewerId));
    case 'unlock': return transitionIn(registry, action.id, unlockCommand);
    case 'accept': return transitionIn(registry, action.id, acceptCommand);
    case 'reject': return transitionIn(registry, action.id, rejectCommand(action.feedback), s => withFeedback(s, action.feedback));
    case 'deactivate': {
      if (!registry.has(action.id)) return registry;
      const m = new Map(registry); m.delete(action.id); return m;
    }
    case 'evict': return evictStale(registry, action.cutoff);
    case 'setFeedback': return patch(registry, action.id, s => withFeedback(s, action.feedback ?? ''));
    case 'addChild': return patch(registry, action.parentId, s => addChild(s, action.childId));
    case 'clear': return emptyRegistry();
  }
}

function set(registry: SessionRegistry, id: string, session: ReviewSession): SessionRegistry {
  const m = new Map(registry); m.set(id, session); return m;
}

function transitionIn(registry: SessionRegistry, id: string, command: ReviewCommand, extra?: (s: ReviewSession) => ReviewSession): SessionRegistry {
  const cur = registry.get(id);
  if (!cur) return registry;
  const updated = applyCommand(cur, command);
  if (updated === cur) return registry;
  return set(registry, id, extra ? extra(updated) : updated);
}

function patch(registry: SessionRegistry, id: string, f: (s: ReviewSession) => ReviewSession): SessionRegistry {
  const cur = registry.get(id);
  if (!cur) return registry;
  return set(registry, id, f(cur));
}

function evictStale(registry: SessionRegistry, cutoff: number): SessionRegistry {
  let changed = false;
  const m = new Map(registry);
  for (const [id, s] of m) { if (s.createdAt < cutoff) { m.delete(id); changed = true; } }
  return changed ? m : registry;
}

// ── Queries ──────────────────────────────────────────────────────────────

export function sessionIsActive(registry: SessionRegistry, id: string): boolean {
  const s = registry.get(id);
  return s ? isActiveState(s.state) : false;
}

export function taskOf(registry: SessionRegistry, id: string): string | undefined {
  return registry.get(id)?.originalTask;
}

export function stateOf(registry: SessionRegistry, id: string): ReviewState | undefined {
  return registry.get(id)?.state;
}

export function canTransition(registry: SessionRegistry, id: string, command: ReviewCommand): boolean {
  const s = registry.get(id);
  return s ? transition(s.state, command)[0] !== s.state : false;
}