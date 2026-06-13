import type { ReviewStore } from "engine/review";

export function validateTaskInput(
  task: string,
  reviewStore: ReviewStore,
  workspaceId: string,
): string | null {
  if (!task) {
    reviewStore.deactivateReview(workspaceId);
    return "Loop mode cancelled.";
  }
  if (reviewStore.isReviewActive(workspaceId)) {
    return "Loop mode is already active. Submit your work via submit_review.";
  }
  return null;
}
