import { globalJobRegistry } from './job.js';

const RUNNER_NUDGE_PROMPT =
  'A runner task is still active in the background.\n' +
  'You must wait or abort it before concluding:\n' +
  '1. Call runner_wait to check/receive new output, then wait again as needed.\n' +
  '2. If the task appears hung, call runner_abort.\n\n' +
  'Do not end the conversation without resolving the background task.';

export function buildRunnerNudgePrompt(): string {
  return RUNNER_NUDGE_PROMPT;
}

export function hasActiveJob(sessionId: string): boolean {
  const jobs = globalJobRegistry;
  const job = jobs.get(sessionId);
  if (job?.status === 'running') return true;
  for (const [, j] of jobs) {
    if (j.parentSessionId === sessionId && j.status === 'running') return true;
  }
  for (const [, j] of jobs) {
    if (j.taskId === sessionId && j.status === 'running') return true;
  }
  return false;
}
