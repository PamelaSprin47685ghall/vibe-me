export type OutputEvent = { readonly _tag: 'Output'; readonly data: string };
export type ErrorEvent = { readonly _tag: 'Error'; readonly message: string };
export type ExitEvent = { readonly _tag: 'Exit'; readonly code: number | null };
export type ExecuteEvent = OutputEvent | ErrorEvent | ExitEvent;

export function outputEvent(data: string): OutputEvent { return { _tag: 'Output', data }; }
export function errorEvent(message: string): ErrorEvent { return { _tag: 'Error', message }; }
export function exitEvent(code: number | null): ExitEvent { return { _tag: 'Exit', code }; }