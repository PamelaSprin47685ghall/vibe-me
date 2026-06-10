// Kernel — ADT types & pure functions
export * from './types/general.js';
export * from './types/runner.js';
export * from './types/agent-policy.js';
export * from './types/nudge.js';
export type {
  Inactive, ActiveReview, LockedReview, CompletedReview, ReviewState,
  ActivateCommand, SubmitCommand, LockCommand, UnlockCommand, CompleteReviewCommand, ReviewCommand,
  ActivatedEvent, SubmittedEvent, LockAcquiredEvent, LockReleasedEvent, CompletedReviewEvent, ReviewEvent,
} from './types/review.js';
export {
  inactive, activeReview, lockedReview, completedReview, matchReviewState,
  activateCommand, submitCommand, lockCommand, unlockCommand, completeReviewCommand, matchReviewCommand,
  activatedEvent, submittedEvent, lockAcquiredEvent, lockReleasedEvent, completedReviewEvent, matchReviewEvent,
} from './types/review.js';
export {
  startExecution, evaluateWait, computeResult, shouldContinue, truncateOutput,
} from './runner/state.js';

// Kernel state machines — selective re-exports to avoid naming conflicts with kernel ADTs
export { type AgentRuntimePolicy, AGENT_POLICIES, AGENT_ROLE_LIST, isAgentRole, getAgentPolicy, applyUniversalPermissionDeny } from './agent-policy/index.js';
export * from './todo/index.js';
export * from './review/index.js';

// Shell — I/O modules
export * from './fuzzy/index.js';
export * from './caps/index.js';
export * from './tree-sitter/index.js';
export * from './ollama/index.js';
export * from './session/index.js';
export * from './util/index.js';
export * from './subagent/index.js';
export * from './mcp/index.js';
export * from './reverie-files.js';
export * from './runner/read-commands.js';

// Shell runner — selective to avoid ExecuteResult/WaitResult/RunnerLanguage conflicts with kernel ADTs
export { RUNNER_LANGUAGES, type ExecuteOptions, type WaitOptions, type StrippedPipe, type StripResult } from './runner/types.js';
export * from './runner/no-head-tail.js';
export * from './runner/paths.js';
export * from './runner/process.js';
export * from './runner/javascript.js';
export * from './runner/jobs.js';
export type { JobRecord, JobStatus, JobHandles, JobEntry, JobRegistry } from './runner/job.js';
export { MAX_OUTPUT_BYTES, emptyJob, appendOutput, markCompleted, markAborted, createHandles, releaseHandles, cleanupFiles, cleanupRegistry, globalJobRegistry, createTempScript, getTempScriptPath } from './runner/job.js';
export * from './runner/nudge.js';
export * from './runner/prompts.js';
