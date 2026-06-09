// ---------------------------------------------------------------------------
// Engine barrel – public API for all plugins.
// Order matters:
//   1. Kernel re-exports first (pure types & functions).
//   2. Shell-specific re-exports after (I/O implementations).
//
// Where kernel and shell export the same name, the kernel's algebraic version
// replaces the shell's string‑union type.  Backward compatibility is preserved
// for all export *names* and for every shell‑specific name not exported by
// the kernel.
// ---------------------------------------------------------------------------

// ── 1. Kernel ─────────────────────────────────────────────────────────────
export * from './types/general.js';
export * from './types/runner.js';
export * from './types/agent-policy.js';
export * from './types/nudge.js';

// ── types/review.ts ADT exports (excluded: ReviewState, ReviewEvent – those
//     come from review/session-unified.ts as string-union types) ─────────────
export type {
  Inactive,
  ActiveReview,
  LockedReview,
  ActivateCommand,
  SubmitCommand,
  LockCommand,
  UnlockCommand,
  CompleteReviewCommand,
  ReviewCommand,
  ActivatedEvent,
  SubmittedEvent,
  LockAcquiredEvent,
  LockReleasedEvent,
  CompletedReviewEvent,
} from './types/review.js';
export {
  inactive,
  activeReview,
  lockedReview,
  matchReviewState,
  activateCommand,
  submitCommand,
  lockCommand,
  unlockCommand,
  completeReviewCommand,
  matchReviewCommand,
  activatedEvent,
  submittedEvent,
  lockAcquiredEvent,
  lockReleasedEvent,
  completedReviewEvent,
  matchReviewEvent,
} from './types/review.js';
export {
  startExecution,
  evaluateWait,
  computeResult,
  shouldContinue,
  truncateOutput,
} from './runner/state.js';
export * from './agent-policy/index.js';
export * from './todo/index.js';
export * from './review/index.js';

// ── 2. Shell modules without naming conflicts ─────────────────────────────
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

// ── 3. Shell: review (ReviewState, ReviewEvent conflict with kernel) ──────
export {
  type ReviewResult,
  REVIEW_CRITERIA,
  REVIEW_INSTRUCTIONS,
  REVIEWER_NUDGE_PROMPT,
} from './review/index.js';

// ── 4. Shell: todo (multiple names conflict with kernel) ──────────────────
export {
  TODO_NUDGE_CHECK_TAG,
  TERMINAL_TODO_STATUSES,
  hasOpenTodos,
  NudgeCoordinator,
  defaultCoordinator,
  clearNudgeSession,
} from './todo/index.js';

// ── 5. Shell: agent-policy (AgentRole conflicts with kernel) ──────────────
export {
  type AgentRuntimePolicy,
  AGENT_POLICIES,
  AGENT_ROLE_LIST,
  isAgentRole,
  getAgentPolicy,
  applyUniversalPermissionDeny,
} from './agent-policy/index.js';

// ── 6. Shell: runner (RunnerLanguage, ExecuteResult, WaitResult conflict) ─
//     Sub-modules are re‑exported individually to avoid the conflicting names
//     from runner/types.js.
export {
  RUNNER_LANGUAGES,
  type ExecuteOptions,
  type WaitOptions,
  type StrippedPipe,
  type StripResult,
} from './runner/types.js';
export * from './runner/no-head-tail.js';
export * from './runner/paths.js';
export * from './runner/process.js';
export * from './runner/javascript.js';
export * from './runner/jobs.js';
export {
  ActiveJob,
  type JobRegistry,
  globalJobRegistry,
  cleanupRegistry,
} from './runner/job.js';
export * from './runner/nudge.js';
export * from './runner/prompts.js';
