import type { JobRegistry } from './job.js';

const RUNNER_NUDGE_PROMPT =
  'A runner task is still active in the background.\n' +
  'You must wait or abort it before concluding:\n' +
  '1. Call runner_wait to check/receive new output, then wait again as needed.\n' +
  '2. If the task appears hung, call runner_abort.\n\n' +
  'Do not end the conversation without resolving the background task.';

export function buildRunnerNudgePrompt(): string {
  return RUNNER_NUDGE_PROMPT;
}

export function hasActiveJob(jobs: JobRegistry, sessionId: string): boolean {
  const entry = jobs.get(sessionId);
  if (entry?.record.status._tag === 'Running') return true;
  for (const [, e] of jobs) {
    if (e.record.parentSessionId === sessionId && e.record.status._tag === 'Running') return true;
  }
  for (const [, e] of jobs) {
    if (e.record.taskId === sessionId && e.record.status._tag === 'Running') return true;
  }
  return false;
}
