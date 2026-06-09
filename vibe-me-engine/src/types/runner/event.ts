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
