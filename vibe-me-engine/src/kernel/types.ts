// ---------------------------------------------------------------------------
// Pure kernel types – algebraic types for all core domains.
// No node:* imports, no side effects, no I/O.
// Every type is immutable (readonly fields / read-only array).
// Discriminated unions make impossible states unrepresentable.
// ---------------------------------------------------------------------------
// Re-export note: every type is exported with `export type` so that
// isolatedModules / verbatimModuleSyntax consumers never see a value
// where they expected a type.
// ---------------------------------------------------------------------------

// =========================================================================
// 1. GENERAL ALGEBRAIC TYPES
// =========================================================================

export type None = { readonly _tag: 'None' };
export type Some<T> = { readonly _tag: 'Some'; readonly value: T };
export type Maybe<T> = None | Some<T>;

/** Pure constructor. */
export function some<T>(value: T): Some<T> {
  return { _tag: 'Some', value };
}

/** Singleton `None` value. */
export const none: None = { _tag: 'None' };

/** Exhaustive match for `Maybe<T>`. */
export function matchMaybe<T, R>(
  value: Maybe<T>,
  patterns: { readonly None: () => R; readonly Some: (value: T) => R },
): R {
  if (value._tag === 'None') return patterns.None();
  return patterns.Some(value.value);
}

// -----------------------------------------------------------------------
export type Ok<T> = { readonly _tag: 'Ok'; readonly value: T };
export type Err<E> = { readonly _tag: 'Err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

/** Pure constructor. */
export function ok<T>(value: T): Ok<T> {
  return { _tag: 'Ok', value };
}

/** Pure constructor. */
export function err<E>(error: E): Err<E> {
  return { _tag: 'Err', error };
}

/** Exhaustive match for `Result<T, E>`. */
export function matchResult<T, E, R>(
  result: Result<T, E>,
  patterns: { readonly Ok: (value: T) => R; readonly Err: (error: E) => R },
): R {
  if (result._tag === 'Ok') return patterns.Ok(result.value);
  return patterns.Err(result.error);
}

// Compile-time exhaustiveness check helpers

/** Unwrap a value or throw — only for use after exhaustive checks in tests. */
export function unsafeUnwrapOk<T>(result: Result<T, unknown>): T {
  if (result._tag === 'Err') throw new Error('Called unsafeUnwrapOk on Err');
  return result.value;
}

/** Unwrap a value from `Some` or throw. */
export function unsafeUnwrapSome<T>(value: Maybe<T>): T {
  if (value._tag === 'None') throw new Error('Called unsafeUnwrapSome on None');
  return value.value;
}

// =========================================================================
// 2. RUNNER DOMAIN
// =========================================================================

// -- RunnerLanguage (sealed) ---------------------------------------------

export type Shell = { readonly _tag: 'Shell' };
export type Python = { readonly _tag: 'Python' };
export type JavaScript = { readonly _tag: 'JavaScript' };
export type RunnerLanguage = Shell | Python | JavaScript;

/** Singleton variant values. */
export const shell: Shell = { _tag: 'Shell' };
export const python: Python = { _tag: 'Python' };
export const javascript: JavaScript = { _tag: 'JavaScript' };

/** Validate a raw string into a `RunnerLanguage`. */
export function runnerLanguageFromString(value: string): Result<RunnerLanguage, string> {
  switch (value) {
    case 'shell': return ok(shell);
    case 'python': return ok(python);
    case 'javascript': return ok(javascript);
    default: return err(`Invalid RunnerLanguage: "${value}"`);
  }
}

/** Convert back to the canonical string. */
export function runnerLanguageToString(language: RunnerLanguage): string {
  switch (language._tag) {
    case 'Shell': return 'shell';
    case 'Python': return 'python';
    case 'JavaScript': return 'javascript';
  }
}

/** Exhaustive match. */
export function matchRunnerLanguage<R>(
  language: RunnerLanguage,
  patterns: {
    readonly Shell: (value: Shell) => R;
    readonly Python: (value: Python) => R;
    readonly JavaScript: (value: JavaScript) => R;
  },
): R {
  switch (language._tag) {
    case 'Shell': return patterns.Shell(language);
    case 'Python': return patterns.Python(language);
    case 'JavaScript': return patterns.JavaScript(language);
  }
}


// -- JobStatus (sealed) --------------------------------------------------

export type Running = { readonly _tag: 'Running' };
export type Completed = { readonly _tag: 'Completed' };
export type Aborted = { readonly _tag: 'Aborted' };
export type JobStatus = Running | Completed | Aborted;

export const running: Running = { _tag: 'Running' };
export const completed: Completed = { _tag: 'Completed' };
export const aborted: Aborted = { _tag: 'Aborted' };

/** Validate a raw string into a `JobStatus`. */
export function jobStatusFromString(value: string): Result<JobStatus, string> {
  switch (value) {
    case 'running': return ok(running);
    case 'completed': return ok(completed);
    case 'aborted': return ok(aborted);
    default: return err(`Invalid JobStatus: "${value}"`);
  }
}

export function jobStatusToString(status: JobStatus): string {
  switch (status._tag) {
    case 'Running': return 'running';
    case 'Completed': return 'completed';
    case 'Aborted': return 'aborted';
  }
}

/** Exhaustive match. */
export function matchJobStatus<R>(
  status: JobStatus,
  patterns: {
    readonly Running: (value: Running) => R;
    readonly Completed: (value: Completed) => R;
    readonly Aborted: (value: Aborted) => R;
  },
): R {
  switch (status._tag) {
    case 'Running': return patterns.Running(status);
    case 'Completed': return patterns.Completed(status);
    case 'Aborted': return patterns.Aborted(status);
  }
}


// -- ExecuteCommand -------------------------------------------------------

export type ExecuteCommand = {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
};

export function createExecuteCommand(params: {
  readonly sessionId: string;
  readonly program: string;
  readonly language: RunnerLanguage;
  readonly cwd?: string;
}): ExecuteCommand {
  return { ...params };
}

// -- JobState (sealed, with data) -----------------------------------------

export type IdleState = { readonly _tag: 'Idle' };
export type RunningState = {
  readonly _tag: 'Running';
  readonly startTime: number;
  readonly bytesRead: number;
  readonly output: string;
};
export type CompletedState = {
  readonly _tag: 'Completed';
  readonly output: string;
};
export type AbortedState = {
  readonly _tag: 'Aborted';
  readonly output: string;
};
export type JobState = IdleState | RunningState | CompletedState | AbortedState;

export const idleState: IdleState = { _tag: 'Idle' };

export function runningState(
  startTime: number,
  bytesRead: number,
  output: string,
): RunningState {
  return { _tag: 'Running', startTime, bytesRead, output };
}

export function completedState(output: string): CompletedState {
  return { _tag: 'Completed', output };
}

export function abortedState(output: string): AbortedState {
  return { _tag: 'Aborted', output };
}

export function matchJobState<R>(
  state: JobState,
  patterns: {
    readonly Idle: (state: IdleState) => R;
    readonly Running: (state: RunningState) => R;
    readonly Completed: (state: CompletedState) => R;
    readonly Aborted: (state: AbortedState) => R;
  },
): R {
  switch (state._tag) {
    case 'Idle': return patterns.Idle(state);
    case 'Running': return patterns.Running(state);
    case 'Completed': return patterns.Completed(state);
    case 'Aborted': return patterns.Aborted(state);
  }
}


// -- ExecuteEvent (sum type for what can happen) --------------------------

export type OutputEvent = {
  readonly _tag: 'Output';
  readonly data: string;
};
export type ErrorEvent = {
  readonly _tag: 'Error';
  readonly message: string;
};
export type ExitEvent = {
  readonly _tag: 'Exit';
  readonly code: number;
};
export type TimeoutEvent = { readonly _tag: 'Timeout' };
export type ExecuteEvent = OutputEvent | ErrorEvent | ExitEvent | TimeoutEvent;

export function outputEvent(data: string): OutputEvent {
  return { _tag: 'Output', data };
}
export function errorEvent(message: string): ErrorEvent {
  return { _tag: 'Error', message };
}
export function exitEvent(code: number): ExitEvent {
  return { _tag: 'Exit', code };
}
export const timeoutEvent: TimeoutEvent = { _tag: 'Timeout' };

export function matchExecuteEvent<R>(
  event: ExecuteEvent,
  patterns: {
    readonly Output: (event: OutputEvent) => R;
    readonly Error: (event: ErrorEvent) => R;
    readonly Exit: (event: ExitEvent) => R;
    readonly Timeout: () => R;
  },
): R {
  switch (event._tag) {
    case 'Output': return patterns.Output(event);
    case 'Error': return patterns.Error(event);
    case 'Exit': return patterns.Exit(event);
    case 'Timeout': return patterns.Timeout();
  }
}


// -- ExecuteResult (algebraic, NOT a bag of optional fields) --------------
// Impossible states eliminated:
//   - {background: false, jobId: "x"}        can't happen
//   - {background: true, output: "ok"}       can't happen
//   - {message: undefined, output: "", ...}  can't happen

export type CompletedResult = {
  readonly _tag: 'Completed';
  readonly output: string;
};
export type BackgroundResult = {
  readonly _tag: 'Background';
  readonly jobId: string;
};
export type FailedResult = {
  readonly _tag: 'Failed';
  readonly message: string;
};
export type ExecuteResult = CompletedResult | BackgroundResult | FailedResult;

export function completedResult(output: string): CompletedResult {
  return { _tag: 'Completed', output };
}
export function backgroundResult(jobId: string): BackgroundResult {
  return { _tag: 'Background', jobId };
}
export function failedResult(message: string): FailedResult {
  return { _tag: 'Failed', message };
}

export function matchExecuteResult<R>(
  result: ExecuteResult,
  patterns: {
    readonly Completed: (result: CompletedResult) => R;
    readonly Background: (result: BackgroundResult) => R;
    readonly Failed: (result: FailedResult) => R;
  },
): R {
  switch (result._tag) {
    case 'Completed': return patterns.Completed(result);
    case 'Background': return patterns.Background(result);
    case 'Failed': return patterns.Failed(result);
  }
}


// -- WaitCommand ----------------------------------------------------------

export type WaitCommand = {
  readonly sessionId: string;
  readonly ms: number;
};

export function createWaitCommand(params: {
  readonly sessionId: string;
  readonly ms: number;
}): WaitCommand {
  return { ...params };
}

// -- WaitResult (algebraic) -----------------------------------------------
// Impossible states eliminated:
//   - {completed: false, output: "..."} ambiguous becomes explicit variants
//   - {completed: true, message: undefined} can't happen

export type WaitCompletedResult = {
  readonly _tag: 'Completed';
  readonly output: string;
};
export type StillRunningResult = {
  readonly _tag: 'StillRunning';
  readonly output: string;
};
export type WaitTimedOutResult = { readonly _tag: 'TimedOut' };
export type WaitResult = WaitCompletedResult | StillRunningResult | WaitTimedOutResult;

export function waitCompletedResult(output: string): WaitCompletedResult {
  return { _tag: 'Completed', output };
}
export function stillRunningResult(output: string): StillRunningResult {
  return { _tag: 'StillRunning', output };
}
export const waitTimedOutResult: WaitTimedOutResult = { _tag: 'TimedOut' };

export function matchWaitResult<R>(
  result: WaitResult,
  patterns: {
    readonly Completed: (result: WaitCompletedResult) => R;
    readonly StillRunning: (result: StillRunningResult) => R;
    readonly TimedOut: () => R;
  },
): R {
  switch (result._tag) {
    case 'Completed': return patterns.Completed(result);
    case 'StillRunning': return patterns.StillRunning(result);
    case 'TimedOut': return patterns.TimedOut();
  }
}


// =========================================================================
// 3. AGENT POLICY DOMAIN
// =========================================================================

// -- AgentRole (7-variant discriminated union, not string) ----------------

export type Orchestrator = { readonly _tag: 'Orchestrator' };
export type EditorRole = { readonly _tag: 'Editor' };
export type ReviewerRole = { readonly _tag: 'Reviewer' };
export type GreperRole = { readonly _tag: 'Greper' };
export type BrowserRole = { readonly _tag: 'Browser' };
export type RunnerRole = { readonly _tag: 'Runner' };
export type ReverieRole = { readonly _tag: 'Reverie' };
export type AgentRole =
  | Orchestrator
  | EditorRole
  | ReviewerRole
  | GreperRole
  | BrowserRole
  | RunnerRole
  | ReverieRole;

export const orchestrator: Orchestrator = { _tag: 'Orchestrator' };
export const editorRole: EditorRole = { _tag: 'Editor' };
export const reviewerRole: ReviewerRole = { _tag: 'Reviewer' };
export const greperRole: GreperRole = { _tag: 'Greper' };
export const browserRole: BrowserRole = { _tag: 'Browser' };
export const runnerRole: RunnerRole = { _tag: 'Runner' };
export const reverieRole: ReverieRole = { _tag: 'Reverie' };

/** Validate a raw string into an `AgentRole`. */
export function agentRoleFromString(value: string): Result<AgentRole, string> {
  switch (value) {
    case 'orchestrator': return ok(orchestrator);
    case 'editor': return ok(editorRole);
    case 'reviewer': return ok(reviewerRole);
    case 'greper': return ok(greperRole);
    case 'browser': return ok(browserRole);
    case 'runner': return ok(runnerRole);
    case 'reverie': return ok(reverieRole);
    default: return err(`Invalid AgentRole: "${value}"`);
  }
}

export function agentRoleToString(role: AgentRole): string {
  switch (role._tag) {
    case 'Orchestrator': return 'orchestrator';
    case 'Editor': return 'editor';
    case 'Reviewer': return 'reviewer';
    case 'Greper': return 'greper';
    case 'Browser': return 'browser';
    case 'Runner': return 'runner';
    case 'Reverie': return 'reverie';
  }
}

export function matchAgentRole<R>(
  role: AgentRole,
  patterns: {
    readonly Orchestrator: (value: Orchestrator) => R;
    readonly Editor: (value: EditorRole) => R;
    readonly Reviewer: (value: ReviewerRole) => R;
    readonly Greper: (value: GreperRole) => R;
    readonly Browser: (value: BrowserRole) => R;
    readonly Runner: (value: RunnerRole) => R;
    readonly Reverie: (value: ReverieRole) => R;
  },
): R {
  switch (role._tag) {
    case 'Orchestrator': return patterns.Orchestrator(role);
    case 'Editor': return patterns.Editor(role);
    case 'Reviewer': return patterns.Reviewer(role);
    case 'Greper': return patterns.Greper(role);
    case 'Browser': return patterns.Browser(role);
    case 'Runner': return patterns.Runner(role);
    case 'Reverie': return patterns.Reverie(role);
  }
}


// -- ToolPermission (Allow | Deny as distinct types) ----------------------

export type Allow = { readonly _tag: 'Allow' };
export type Deny = { readonly _tag: 'Deny' };
export type ToolPermission = Allow | Deny;

export const allow: Allow = { _tag: 'Allow' };
export const deny: Deny = { _tag: 'Deny' };

export function toolPermissionFromString(value: string): Result<ToolPermission, string> {
  switch (value) {
    case 'allow': return ok(allow);
    case 'deny': return ok(deny);
    default: return err(`Invalid ToolPermission: "${value}"`);
  }
}

export function toolPermissionToString(permission: ToolPermission): string {
  switch (permission._tag) {
    case 'Allow': return 'allow';
    case 'Deny': return 'deny';
  }
}

export function matchToolPermission<R>(
  permission: ToolPermission,
  patterns: { readonly Allow: () => R; readonly Deny: () => R },
): R {
  switch (permission._tag) {
    case 'Allow': return patterns.Allow();
    case 'Deny': return patterns.Deny();
  }
}


// -- ToolPolicy -----------------------------------------------------------

export type ToolPolicy = {
  readonly tools: Readonly<Record<string, ToolPermission>>;
  readonly disabledTools: readonly string[];
};

export function createToolPolicy(params: {
  readonly tools: Readonly<Record<string, ToolPermission>>;
  readonly disabledTools?: readonly string[];
}): ToolPolicy {
  return {
    tools: params.tools,
    disabledTools: params.disabledTools ?? [],
  };
}

// -- CanonicalToolName -------------------------------------------------------

export const CANONICAL_TOOL_NAMES = [
  'read',
  'write',
  'edit',
  'runner',
  'glob',
  'fuzzy_find',
  'fuzzy_grep',
  'grep',
  'editor',
  'greper',
  'reverie',
  'submit_review',
  'submit_review_result',
  'webfetch',
  'websearch',
  'browser',
  'task',
  'runner_wait',
  'runner_abort',
  'stealth_browser_mcp_star',
] as const;

export type CanonicalToolName = (typeof CANONICAL_TOOL_NAMES)[number];

// -- UniversalPermissionRule (discriminated union) ---------------------------

export type DenyAllRule = {
  readonly _tag: 'DenyAll';
  readonly permissionName: string;
};

export type DenyAllExceptRule = {
  readonly _tag: 'DenyAllExcept';
  readonly permissionName: string;
  readonly excludedRoles: readonly AgentRole[];
};

export type AllowForRolesRule = {
  readonly _tag: 'AllowForRoles';
  readonly permissionName: string;
  readonly includedRoles: readonly AgentRole[];
};

export type UniversalPermissionRule =
  | DenyAllRule
  | DenyAllExceptRule
  | AllowForRolesRule;

export function denyAllRule(permissionName: string): DenyAllRule {
  return { _tag: 'DenyAll', permissionName };
}

export function denyAllExceptRule(
  permissionName: string,
  excludedRoles: readonly AgentRole[],
): DenyAllExceptRule {
  return { _tag: 'DenyAllExcept', permissionName, excludedRoles };
}

export function allowForRolesRule(
  permissionName: string,
  includedRoles: readonly AgentRole[],
): AllowForRolesRule {
  return { _tag: 'AllowForRoles', permissionName, includedRoles };
}

/** Evaluate a single permission rule against an agent. Returns the permission
 *  value if the rule applies, or null if the rule does not match. */
export function evaluateUniversalRule(
  rule: UniversalPermissionRule,
  agent: AgentRole,
): { readonly permissionName: string; readonly value: ToolPermission } | null {
  switch (rule._tag) {
    case 'DenyAll':
      return { permissionName: rule.permissionName, value: deny };
    case 'DenyAllExcept': {
      const excluded = rule.excludedRoles.some((r) => r._tag === agent._tag);
      return excluded
        ? null
        : { permissionName: rule.permissionName, value: deny };
    }
    case 'AllowForRoles': {
      const included = rule.includedRoles.some((r) => r._tag === agent._tag);
      return included
        ? { permissionName: rule.permissionName, value: allow }
        : null;
    }
  }
}


// -- AGENT_ROLES as const array -----------------------------------------------

export const AGENT_ROLES: readonly AgentRole[] = [
  orchestrator,
  editorRole,
  reviewerRole,
  greperRole,
  browserRole,
  runnerRole,
  reverieRole,
] as const;

// -- computePermissions -------------------------------------------------------

/** Compute default permissions for an agent by applying all universal rules
 *  in order (first-write-wins). */
export function computePermissions(
  agent: AgentRole,
  rules: readonly UniversalPermissionRule[],
): ReadonlyMap<string, ToolPermission> {
  const result = new Map<string, ToolPermission>();
  for (const rule of rules) {
    const evaluated = evaluateUniversalRule(rule, agent);
    if (evaluated !== null && !result.has(evaluated.permissionName)) {
      result.set(evaluated.permissionName, evaluated.value);
    }
  }
  return result;
}

// =========================================================================
// 4. REVIEW DOMAIN
// =========================================================================

// -- ReviewState (Inactive | Active with task | Locked) -------------------

export type Inactive = { readonly _tag: 'Inactive' };
export type ActiveReview = {
  readonly _tag: 'Active';
  readonly task: string;
};
export type LockedReview = {
  readonly _tag: 'Locked';
  readonly task: string;
  readonly reviewerId: string;
};
export type ReviewState = Inactive | ActiveReview | LockedReview;

export const inactive: Inactive = { _tag: 'Inactive' };

export function activeReview(task: string): ActiveReview {
  return { _tag: 'Active', task };
}

export function lockedReview(task: string, reviewerId: string): LockedReview {
  return { _tag: 'Locked', task, reviewerId };
}

export function matchReviewState<R>(
  state: ReviewState,
  patterns: {
    readonly Inactive: () => R;
    readonly Active: (state: ActiveReview) => R;
    readonly Locked: (state: LockedReview) => R;
  },
): R {
  switch (state._tag) {
    case 'Inactive': return patterns.Inactive();
    case 'Active': return patterns.Active(state);
    case 'Locked': return patterns.Locked(state);
  }
}


// -- ReviewCommand --------------------------------------------------------

export type ActivateCommand = {
  readonly _tag: 'Activate';
  readonly task: string;
};
export type SubmitCommand = { readonly _tag: 'Submit' };
export type LockCommand = {
  readonly _tag: 'Lock';
  readonly reviewerId: string;
};
export type UnlockCommand = { readonly _tag: 'Unlock' };
export type CompleteReviewCommand = {
  readonly _tag: 'Complete';
  readonly accepted: boolean;
  readonly feedback?: string;
};
export type ReviewCommand =
  | ActivateCommand
  | SubmitCommand
  | LockCommand
  | UnlockCommand
  | CompleteReviewCommand;

export function activateCommand(task: string): ActivateCommand {
  return { _tag: 'Activate', task };
}
export const submitCommand: SubmitCommand = { _tag: 'Submit' };
export function lockCommand(reviewerId: string): LockCommand {
  return { _tag: 'Lock', reviewerId };
}
export const unlockCommand: UnlockCommand = { _tag: 'Unlock' };
export function completeReviewCommand(
  accepted: boolean,
  feedback?: string,
): CompleteReviewCommand {
  return { _tag: 'Complete', accepted, ...(feedback !== undefined ? { feedback } : {}) };
}

export function matchReviewCommand<R>(
  command: ReviewCommand,
  patterns: {
    readonly Activate: (cmd: ActivateCommand) => R;
    readonly Submit: () => R;
    readonly Lock: (cmd: LockCommand) => R;
    readonly Unlock: () => R;
    readonly Complete: (cmd: CompleteReviewCommand) => R;
  },
): R {
  switch (command._tag) {
    case 'Activate': return patterns.Activate(command);
    case 'Submit': return patterns.Submit();
    case 'Lock': return patterns.Lock(command);
    case 'Unlock': return patterns.Unlock();
    case 'Complete': return patterns.Complete(command);
  }
}


// -- ReviewEvent ----------------------------------------------------------

export type ActivatedEvent = {
  readonly _tag: 'Activated';
  readonly task: string;
};
export type SubmittedEvent = { readonly _tag: 'Submitted' };
export type LockAcquiredEvent = {
  readonly _tag: 'LockAcquired';
  readonly reviewerId: string;
};
export type LockReleasedEvent = { readonly _tag: 'LockReleased' };
export type CompletedReviewEvent = {
  readonly _tag: 'Completed';
  readonly accepted: boolean;
  readonly feedback?: string;
};
export type ReviewEvent =
  | ActivatedEvent
  | SubmittedEvent
  | LockAcquiredEvent
  | LockReleasedEvent
  | CompletedReviewEvent;

export function activatedEvent(task: string): ActivatedEvent {
  return { _tag: 'Activated', task };
}
export const submittedEvent: SubmittedEvent = { _tag: 'Submitted' };
export function lockAcquiredEvent(reviewerId: string): LockAcquiredEvent {
  return { _tag: 'LockAcquired', reviewerId };
}
export const lockReleasedEvent: LockReleasedEvent = { _tag: 'LockReleased' };
export function completedReviewEvent(
  accepted: boolean,
  feedback?: string,
): CompletedReviewEvent {
  return {
    _tag: 'Completed',
    accepted,
    ...(feedback !== undefined ? { feedback } : {}),
  };
}

export function matchReviewEvent<R>(
  event: ReviewEvent,
  patterns: {
    readonly Activated: (ev: ActivatedEvent) => R;
    readonly Submitted: () => R;
    readonly LockAcquired: (ev: LockAcquiredEvent) => R;
    readonly LockReleased: () => R;
    readonly Completed: (ev: CompletedReviewEvent) => R;
  },
): R {
  switch (event._tag) {
    case 'Activated': return patterns.Activated(event);
    case 'Submitted': return patterns.Submitted();
    case 'LockAcquired': return patterns.LockAcquired(event);
    case 'LockReleased': return patterns.LockReleased();
    case 'Completed': return patterns.Completed(event);
  }
}


// =========================================================================
// 5. TODO / NUDGE DOMAIN
// =========================================================================

// -- NudgeAction (sealed) -------------------------------------------------

export type NudgeTodo = { readonly _tag: 'NudgeTodo' };
export type NudgeLoop = { readonly _tag: 'NudgeLoop' };
export type NudgeRunner = { readonly _tag: 'NudgeRunner' };
export type NudgeNone = { readonly _tag: 'NudgeNone' };
export type NudgeAction = NudgeTodo | NudgeLoop | NudgeRunner | NudgeNone;

export const nudgeTodo: NudgeTodo = { _tag: 'NudgeTodo' };
export const nudgeLoop: NudgeLoop = { _tag: 'NudgeLoop' };
export const nudgeRunner: NudgeRunner = { _tag: 'NudgeRunner' };
export const nudgeNone: NudgeNone = { _tag: 'NudgeNone' };

/** Validate a raw string (from existing codebase) into a `NudgeAction`. */
export function nudgeActionFromString(value: string): Result<NudgeAction, string> {
  switch (value) {
    case 'nudge-todo': return ok(nudgeTodo);
    case 'nudge-loop': return ok(nudgeLoop);
    case 'nudge-runner': return ok(nudgeRunner);
    case 'none': return ok(nudgeNone);
    default: return err(`Invalid NudgeAction: "${value}"`);
  }
}

export function nudgeActionToString(action: NudgeAction): string {
  switch (action._tag) {
    case 'NudgeTodo': return 'nudge-todo';
    case 'NudgeLoop': return 'nudge-loop';
    case 'NudgeRunner': return 'nudge-runner';
    case 'NudgeNone': return 'none';
  }
}

export function matchNudgeAction<R>(
  action: NudgeAction,
  patterns: {
    readonly NudgeTodo: () => R;
    readonly NudgeLoop: () => R;
    readonly NudgeRunner: () => R;
    readonly NudgeNone: () => R;
  },
): R {
  switch (action._tag) {
    case 'NudgeTodo': return patterns.NudgeTodo();
    case 'NudgeLoop': return patterns.NudgeLoop();
    case 'NudgeRunner': return patterns.NudgeRunner();
    case 'NudgeNone': return patterns.NudgeNone();
  }
}


// -- NudgeContext (no optional fields) ------------------------------------
// Every field is required — callers must provide explicit values.

export type NudgeContext = {
  readonly todos: readonly string[];
  readonly lastAssistantMessage: string;
  readonly hasActiveRunner: boolean;
  readonly isLoopActive: boolean;
};

export function createNudgeContext(params: NudgeContext): NudgeContext {
  return { ...params };
}

// -- TimestampKey ---------------------------------------------------------
// Maps exactly to the fields used for throttle-tracking in NudgeCoordinator.

export type TimestampKey = 'todoAt' | 'loopAt' | 'runnerAt' | 'lastIndex';

// Compile-time guard: every NudgeAction maps to a valid TimestampKey.
const _timestampKeyMap = {
  NudgeTodo: 'todoAt',
  NudgeLoop: 'loopAt',
  NudgeRunner: 'runnerAt',
  NudgeNone: 'todoAt',
} as const satisfies Record<NudgeAction['_tag'], TimestampKey>;

/** Look up the throttle-tracking key for a given action. */
export function timestampKeyForAction(action: NudgeAction): TimestampKey {
  return _timestampKeyMap[action._tag];
}

// -- SessionNudgeState -------------------------------------------------------

export type SessionNudgeState = {
  readonly todoAt: number;
  readonly loopAt: number;
  readonly runnerAt: number;
  readonly lastIndex: number;
};

export const freshSessionNudgeState: SessionNudgeState = {
  todoAt: 0,
  loopAt: 0,
  runnerAt: 0,
  lastIndex: -1,
};

// -- NudgeCoordinatorState (immutable, not a class) --------------------------

export type NudgeCoordinatorState = {
  readonly sessions: ReadonlyMap<string, SessionNudgeState>;
};
