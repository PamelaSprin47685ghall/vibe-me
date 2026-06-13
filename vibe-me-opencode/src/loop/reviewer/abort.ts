export function prepareRoundAbortController(
  abortSignal: AbortSignal | undefined,
): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  abortSignal?.addEventListener('abort', onOuterAbort);
  return {
    controller,
    cleanup: () => abortSignal?.removeEventListener('abort', onOuterAbort),
  };
}

export function cleanupRoundAbortController(
  cleanup: () => void,
  controller: AbortController,
): void {
  cleanup();
  controller.abort();
}
