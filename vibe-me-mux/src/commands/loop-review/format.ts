import type { BuildLoopMessage, PreReviewOutcome } from './types.js';

export function formatPreReviewResult(
  task: string,
  outcome: PreReviewOutcome,
  buildLoopMessage: BuildLoopMessage,
): string {
  switch (outcome._tag) {
    case "Passed":
      return buildLoopMessage(
        task,
        "Loop mode is active. Pre-review passed. Complete the task above, then call submit_review with:",
      );
    case "Skipped": {
      const reasonText =
        outcome.reason === "noTaskService"
          ? "pre-review unavailable — no task service"
          : outcome.reason === "timedOut"
            ? "pre-review timed out"
            : "pre-review failed";
      return buildLoopMessage(
        task,
        `Loop mode is active (${reasonText}). Complete the task above, then call submit_review with:`,
      );
    }
    case "Feedback":
      return buildLoopMessage(
        task,
        "Pre-review feedback:",
        "",
        outcome.feedback,
        "",
        "Loop mode is active. Address the pre-review feedback above while completing the task. Then call submit_review with:",
      );
  }
}
