import type { AbortSuppressor } from '../util/abort.js';
import {
  type ReviewState as ADTState,
  type ReviewCommand,
  lockCommand,
  unlockCommand,
  completeReviewCommand,
} from '../types/review.js';
import { isActive as isActiveState, transition as pureTransition } from './state.js';
import { ReviewSessionNode, type ReviewResult } from './session-node.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const sessionRegistry = new Map<string, ReviewSessionNode>();

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

// ── Lifecycle ────────────────────────────────────────────────────────────

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
  return node ? isActiveState(node.state) : false;
}

export function deactivateReview(sessionID: string): void {
  const node = sessionRegistry.get(sessionID);
  if (node) {
    node[Symbol.dispose]();
    sessionRegistry.delete(sessionID);
  }
}

export function clearReviewSessions(): void {
  for (const node of sessionRegistry.values()) {
    node[Symbol.dispose]();
  }
  sessionRegistry.clear();
}

// ── Locking ──────────────────────────────────────────────────────────────

export function tryAcquireReviewLock(sessionID: string): boolean {
  const node = sessionRegistry.get(sessionID);
  return node?.transition(lockCommand(sessionID)) ?? false;
}

export function releaseReviewLock(sessionID: string): void {
  sessionRegistry.get(sessionID)?.transition(completeReviewCommand(true));
}

export function unlockReview(sessionID: string): void {
  sessionRegistry.get(sessionID)?.transition(unlockCommand);
}

export function tryLockReview(sessionID: string): boolean {
  return tryAcquireReviewLock(sessionID);
}

// ── Resolution ───────────────────────────────────────────────────────────

export function setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void {
  getOrCreate(sessionID).setPendingResolver(resolve);
}

export function resolvePendingReview(sessionID: string, result: ReviewResult): boolean {
  const node = sessionRegistry.get(sessionID);
  if (!node) return false;
  node.lastFeedback = result.feedback;
  node.completeResolution(result);
  node.transition(completeReviewCommand(result.accepted, result.feedback));
  return true;
}

export function completeReview(sessionID: string, result: ReviewResult): void {
  const node = sessionRegistry.get(sessionID);
  if (!node) return;
  node.lastFeedback = result.feedback;
  node.transition(completeReviewCommand(result.accepted, result.feedback));
}

// ── Query ────────────────────────────────────────────────────────────────

export function getReviewTask(sessionID: string): string | undefined {
  return sessionRegistry.get(sessionID)?.originalTask;
}

export function getReviewState(sessionID: string): ADTState | undefined {
  return sessionRegistry.get(sessionID)?.state;
}

export function getLastFeedback(sessionID: string): string | null | undefined {
  return sessionRegistry.get(sessionID)?.lastFeedback;
}

export function canTransition(sessionID: string, command: ReviewCommand): boolean {
  const node = sessionRegistry.get(sessionID);
  if (!node) return false;
  const [next] = pureTransition(node.state, command);
  return next !== node.state;
}

// ── Mutation ─────────────────────────────────────────────────────────────

export function setLastFeedback(sessionID: string, feedback: string | null): void {
  const node = sessionRegistry.get(sessionID);
  if (node) node.lastFeedback = feedback;
}

export function setAbortSuppressor(sessionID: string, suppressor: AbortSuppressor): void {
  getOrCreate(sessionID).setAbortSuppressor(suppressor);
}

export async function getOrCreateAbortSuppressor(sessionID: string, suppressAfterMs: number): Promise<AbortSuppressor> {
  const node = getOrCreate(sessionID);
  if (!node.abortSuppressor) {
    const { createAbortSuppressor } = await import('../util/abort.js');
    node.setAbortSuppressor(createAbortSuppressor(suppressAfterMs));
  }
  return node.abortSuppressor!;
}

// ── Hierarchy ────────────────────────────────────────────────────────────

export function addChild(parentID: string, childID: string): void {
  if (!parentID || !childID) return;
  const parent = getOrCreate(parentID);
  const child = getOrCreate(childID);
  parent.addChild(child);
}
