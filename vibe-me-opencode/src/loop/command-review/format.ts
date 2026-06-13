export function formatAcceptedResult(task: string): string {
  return (
    `Pre-review passed. Task "${task}" already meets all criteria` +
    ` — no changes needed.`
  );
}

export function formatTerminatedResult(): string {
  return 'Pre-review could not complete.';
}

export function formatFeedbackResult(task: string, feedback: string): string {
  return (
    `Task (loop-review): ${task}\n\n` +
    `=== Pre-review Feedback ===\n\n${feedback}\n\n` +
    'Address the feedback above, then call submit_review with:\n' +
    '- report: a detailed description of what you did and why\n' +
    '- affectedFiles: list of every file you modified or created\n\n' +
    'A reviewer will examine your submission. If accepted, you are done.' +
    ' If rejected, you will receive specific feedback to address.'
  );
}
