import { Result, ok, err } from './general.js';

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

export type NudgeContext = {
  readonly todos: readonly string[];
  readonly lastAssistantMessage: string;
  readonly hasActiveRunner: boolean;
  readonly isLoopActive: boolean;
};

export function createNudgeContext(params: NudgeContext): NudgeContext {
  return { ...params };
}

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

export type NudgeCoordinatorState = {
  readonly sessions: ReadonlyMap<string, SessionNudgeState>;
};
