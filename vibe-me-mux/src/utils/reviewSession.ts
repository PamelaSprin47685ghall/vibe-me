import {
  activateReview,
  addChild,
  deactivateReview,
  isReviewActive,
  unlockReview,
  tryLockReview,
  getReviewTask,
  clearReviewSessions,
  setLastFeedback,
  getLastFeedback,
} from "engine/review";

export class ReviewSessionManager {
  setLastFeedback(sessionID: string, feedback: string | null): void {
    setLastFeedback(sessionID, feedback);
  }

  getLastFeedback(sessionID: string): string | null | undefined {
    return getLastFeedback(sessionID);
  }

  activate(sessionID: string, task: string): void {
    activateReview(sessionID, task);
  }

  addChild(parentID: string, childID: string): void {
    addChild(parentID, childID);
  }

  cascadeDelete(sessionID: string): void {
    deactivateReview(sessionID);
  }

  deactivate(sessionID: string): void {
    deactivateReview(sessionID);
  }

  isActive(sessionID: string): boolean {
    return isReviewActive(sessionID);
  }

  unlock(sessionID: string): void {
    unlockReview(sessionID);
  }

  tryLock(sessionID: string): boolean {
    return tryLockReview(sessionID);
  }

  getTask(sessionID: string): string | undefined {
    return getReviewTask(sessionID);
  }

  delete(sessionID: string): void {
    deactivateReview(sessionID);
  }

  clear(): void {
    clearReviewSessions();
  }
}

const reviewSessions = new ReviewSessionManager();

export { reviewSessions };
