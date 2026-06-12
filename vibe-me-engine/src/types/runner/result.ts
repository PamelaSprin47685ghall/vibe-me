export type CompletedResult = { readonly _tag: 'Completed'; readonly output: string };
export type FailedResult = { readonly _tag: 'Failed'; readonly message: string };
export type ExecuteResult = CompletedResult | FailedResult;

export function completedResult(output: string): CompletedResult { return { _tag: 'Completed', output }; }
export function failedResult(message: string): FailedResult { return { _tag: 'Failed', message }; }

export type WaitCompletedResult = { readonly _tag: 'Completed'; readonly output: string };
export type WaitAbortedResult = { readonly _tag: 'Aborted'; readonly output: string };
export type WaitStillRunningResult = { readonly _tag: 'StillRunning'; readonly output: string };
export type WaitResult = WaitCompletedResult | WaitAbortedResult | WaitStillRunningResult;

export function waitCompletedResult(output: string): WaitCompletedResult { return { _tag: 'Completed', output }; }
export function waitAbortedResult(output: string): WaitAbortedResult { return { _tag: 'Aborted', output }; }
export function stillRunningResult(output: string): WaitStillRunningResult { return { _tag: 'StillRunning', output }; }