import { createAbortSuppressor } from '../util/abort.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface ReviewResult {
  feedback: string | null;
  terminated?: boolean;
}

interface ReviewEntry {
  active: boolean;
  originalTask?: string;
  locked: boolean;
  createdAt: number;
}

const reviewSessions = new Map<string, ReviewEntry>();
const children = new Map<string, Set<string>>();
const lastFeedbackMap = new Map<string, string | null>();
const pendingResolve = new Map<string, (result: ReviewResult) => void>();
const abortSuppressors = new Map<string, ReturnType<typeof createAbortSuppressor>>();

function evictStale(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, entry] of reviewSessions) {
    if (entry.createdAt < cutoff) {
      reviewSessions.delete(key);
      children.delete(key);
      lastFeedbackMap.delete(key);
      pendingResolve.delete(key);
    }
  }
}

export function setLastFeedback(sessionID: string, feedback: string | null): void {
  if (feedback === null) lastFeedbackMap.delete(sessionID);
  else lastFeedbackMap.set(sessionID, feedback);
}

export function getLastFeedback(sessionID: string): string | null | undefined {
  return lastFeedbackMap.get(sessionID);
}

export function activateReview(sessionID: string, task: string): void {
  evictStale();
  reviewSessions.set(sessionID, { active: true, originalTask: task, locked: false, createdAt: Date.now() });
}

export function addChild(parentID: string, childID: string): void {
  if (!parentID || !childID) return;
  const set = children.get(parentID);
  if (set) set.add(childID);
  else children.set(parentID, new Set([childID]));
}

function cascadeDelete(sessionID: string): void {
  const childIDs = children.get(sessionID);
  if (childIDs) {
    for (const childID of childIDs) {
      const resolve = pendingResolve.get(childID);
      resolve?.({ feedback: 'Parent session closed.', terminated: true });
      reviewSessions.delete(childID);
      lastFeedbackMap.delete(childID);
      pendingResolve.delete(childID);
    }
    children.delete(sessionID);
  }
  reviewSessions.delete(sessionID);
  lastFeedbackMap.delete(sessionID);
  pendingResolve.delete(sessionID);
}

export function deactivateReview(sessionID: string): void {
  evictStale();
  cascadeDelete(sessionID);
}

export function isReviewActive(sessionID: string): boolean {
  return reviewSessions.get(sessionID)?.active === true;
}

export function unlockReview(sessionID: string): void {
  const entry = reviewSessions.get(sessionID);
  if (entry) entry.locked = false;
}

export function tryLockReview(sessionID: string): boolean {
  const entry = reviewSessions.get(sessionID);
  if (!entry || entry.locked) return false;
  entry.locked = true;
  return true;
}

export function getReviewTask(sessionID: string): string | undefined {
  return reviewSessions.get(sessionID)?.originalTask;
}

export function setPendingReview(sessionID: string, resolve: (result: ReviewResult) => void): void {
  evictStale();
  pendingResolve.set(sessionID, resolve);
  if (!reviewSessions.has(sessionID)) {
    reviewSessions.set(sessionID, { active: false, locked: false, createdAt: Date.now() });
  }
}

export function resolvePendingReview(sessionID: string, result: ReviewResult): boolean {
  evictStale();
  const resolve = pendingResolve.get(sessionID);
  if (!resolve) return false;
  resolve(result);
  pendingResolve.delete(sessionID);
  return true;
}

export function clearReviewSessions(): void {
  for (const sessionID of pendingResolve.keys()) {
    pendingResolve.get(sessionID)?.({ feedback: 'Session expired', terminated: true });
  }
  reviewSessions.clear();
  children.clear();
  lastFeedbackMap.clear();
  pendingResolve.clear();
  abortSuppressors.clear();
}

export function getOrCreateAbortSuppressor(sessionID: string, suppressAfterMs: number): ReturnType<typeof createAbortSuppressor> {
  let sup = abortSuppressors.get(sessionID);
  if (!sup) {
    sup = createAbortSuppressor(suppressAfterMs);
    abortSuppressors.set(sessionID, sup);
  }
  return sup;
}
