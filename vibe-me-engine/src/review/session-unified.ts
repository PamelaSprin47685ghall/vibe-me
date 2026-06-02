import type { AbortSuppressor } from '../util/abort';

export type ReviewState = 'Idle' | 'AwaitingSubmission' | 'UnderReview' | 'Completed';
export type ReviewEvent = 'ACTIVATE' | 'ACQUIRE_LOCK' | 'UNLOCK' | 'RELEASE_LOCK' | 'COMPLETE';
export interface ReviewResult { accepted: boolean; feedback?: string; terminated?: boolean }

const STATE_TRANSITIONS: Record<ReviewState, Partial<Record<ReviewEvent, ReviewState>>> = {
  Idle: { ACTIVATE: 'AwaitingSubmission' },
  AwaitingSubmission: { ACQUIRE_LOCK: 'UnderReview', COMPLETE: 'Completed' },
  UnderReview: { UNLOCK: 'AwaitingSubmission', RELEASE_LOCK: 'Completed', COMPLETE: 'Completed' },
  Completed: {},
};

class ReviewSessionNode implements Disposable {
  #state: ReviewState = 'Idle';
  
  get state(): ReviewState { return this.#state; }
  readonly createdAt = Date.now();
  originalTask?: string;
  lastFeedback?: string | null;
  parent?: ReviewSessionNode;
  readonly children = new Set<ReviewSessionNode>();
  private resolver?: (result: ReviewResult) => void;
  private abortSuppressor?: AbortSuppressor;

  constructor(public readonly id: string) {}

  transition(event: ReviewEvent): boolean {
    const nextState = STATE_TRANSITIONS[this.#state]?.[event];
    if (!nextState) return false;
    this.#state = nextState;
    this.#onTransition(event, nextState);
    return true;
  }

  #onTransition(event: ReviewEvent, newState: ReviewState): void {
    if (newState === 'Completed') this.completeResolution();
  }

  activate(task: string): void {
    this.originalTask = task;
    if (!this.transition('ACTIVATE')) {
      throw new Error(`Cannot activate from ${this.state}`);
    }
  }

  setPendingResolver(resolve: (result: ReviewResult) => void): void {
    this.resolver = resolve;
  }

  setAbortSuppressor(suppressor: AbortSuppressor): void {
    this.abortSuppressor = suppressor;
  }

  completeResolution(): void {
    if (this.resolver) {
      this.resolver({ accepted: true });
      this.resolver = undefined;
    }
    this.abortSuppressor?.restore();
    this.abortSuppressor = undefined;
  }

  addChild(child: ReviewSessionNode): void {
    this.children.add(child);
    child.parent = this;
  }

  [Symbol.dispose](): void {
    const stack = [this];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.resolver) {
        node.resolver({ accepted: false, terminated: true });
        node.resolver = undefined;
      }
      node.abortSuppressor?.restore();
      node.abortSuppressor = undefined;
      stack.push(...node.children);
      node.children.clear();
    }
  }
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionRegistry = new Map<string, ReviewSessionNode>();

function evictStale(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, node] of sessionRegistry) {
    if (node.createdAt < cutoff) {
      node[Symbol.dispose]();
      sessionRegistry.delete(id);
    }
  }
}

function getOrCreate(sessionID: string): ReviewSessionNode {
  evictStale();
  let node = sessionRegistry.get(sessionID);
  if (!node) {
    node = new ReviewSessionNode(sessionID);
    sessionRegistry.set(sessionID, node);
  }
  return node;
}

export function activateReview(sessionID: string, task: string, parentSessionID?: string): void {
  const node = getOrCreate(sessionID);
  node.activate(task);
  if (parentSessionID) {
    const parent = getOrCreate(parentSessionID);
    parent.addChild(node);
  }
}

export function isReviewActive(sessionID: string): boolean {
  const node = sessionRegistry.get(sessionID);
  return node?.state === 'AwaitingSubmission' || node?.state === 'UnderReview';
}

export function tryAcquireReviewLock(sessionID: string): boolean {
  const node = sessionRegistry.get(sessionID);
  return node?.transition('ACQUIRE_LOCK') ?? false;
}

export function releaseReviewLock(sessionID: string): void {
  sessionRegistry.get(sessionID)?.transition('RELEASE_LOCK');
}

export function getReviewTask(sessionID: string): string | undefined {
  return sessionRegistry.get(sessionID)?.originalTask;
}

export function setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void {
  getOrCreate(sessionID).setPendingResolver(resolve);
}

export function setLastFeedback(sessionID: string, feedback: string | null): void {
  const node = sessionRegistry.get(sessionID);
  if (node) node.lastFeedback = feedback;
}

export function getLastFeedback(sessionID: string): string | null | undefined {
  return sessionRegistry.get(sessionID)?.lastFeedback;
}

export function setAbortSuppressor(sessionID: string, suppressor: AbortSuppressor): void {
  getOrCreate(sessionID).setAbortSuppressor(suppressor);
}

export function clearReviewSessions(): void {
  for (const node of sessionRegistry.values()) {
    node[Symbol.dispose]();
  }
  sessionRegistry.clear();
}

export function unlockReview(sessionID: string): void {
  sessionRegistry.get(sessionID)?.transition('UNLOCK');
}

export function completeReview(sessionID: string, result: ReviewResult): void {
  const node = sessionRegistry.get(sessionID);
  if (!node) return;
  node.lastFeedback = result.feedback;
  node.transition('COMPLETE');
}

export function getReviewState(sessionID: string): ReviewState | undefined {
  return sessionRegistry.get(sessionID)?.state;
}

export function addChild(parentID: string, childID: string): void {
  if (!parentID || !childID) return;
  const parent = getOrCreate(parentID);
  const child = getOrCreate(childID);
  parent.addChild(child);
}

export function deactivateReview(sessionID: string): void {
  const node = sessionRegistry.get(sessionID);
  if (node) {
    node[Symbol.dispose]();
    sessionRegistry.delete(sessionID);
  }
}

export function resolvePendingReview(sessionID: string, result: ReviewResult): boolean {
  const node = sessionRegistry.get(sessionID);
  if (!node) return false;
  node.lastFeedback = result.feedback;
  node.completeResolution();
  node.transition('COMPLETE');
  return true;
}

export function tryLockReview(sessionID: string): boolean {
  return tryAcquireReviewLock(sessionID);
}

export async function getOrCreateAbortSuppressor(sessionID: string, suppressAfterMs: number): Promise<AbortSuppressor> {
  const node = getOrCreate(sessionID);
  if (!(node as any).abortSuppressor) {
    const { createAbortSuppressor } = await import('../util/abort.js');
    node.setAbortSuppressor(createAbortSuppressor(suppressAfterMs));
  }
  return (node as any).abortSuppressor!;
}

export function canTransition(sessionID: string, event: ReviewEvent): boolean {
  const node = sessionRegistry.get(sessionID);
  if (!node) return false;
  return STATE_TRANSITIONS[node.state]?.[event] !== undefined;
}
