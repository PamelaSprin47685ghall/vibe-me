import { isAbortError, isAbortErrorName, createAbortSuppressor } from 'engine/util';

export { isAbortError, isAbortErrorName, createAbortSuppressor };

export function getSessionIdFromContext(ctx) {
  return ctx?.sessionManager?.getSessionId?.() || ctx?.sessionManager?.sessionId || null;
}

export function asErrorResult(error) {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

export function stringArraySchema(pi, description) {
  return pi.typebox.Type.Array(pi.typebox.Type.String({ description }));
}

export function raceWithSignal(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    const { promise: abortPromise, reject } = Promise.withResolvers();
    const onAbort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    signal.addEventListener('abort', onAbort, { once: true });
    const result = Promise.race([promise, abortPromise]);
    result.finally(() => signal.removeEventListener('abort', onAbort));
    return result;
}
