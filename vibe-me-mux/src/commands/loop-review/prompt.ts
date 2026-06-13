export function buildReviewPrompt(task: string): string {
  return [
    "You are a reviewer evaluating whether a task description is clear and actionable enough to begin work.",
    "",
    "=== Task Description ===",
    "",
    task,
    "",
    "Evaluate the task description above. If it is clear, specific, and actionable, respond with exactly: PASS",
    "If the task description has issues (ambiguous, missing requirements, contradictory), provide specific, actionable feedback.",
  ].join("\n");
}
