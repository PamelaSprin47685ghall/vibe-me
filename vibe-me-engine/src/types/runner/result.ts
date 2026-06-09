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
