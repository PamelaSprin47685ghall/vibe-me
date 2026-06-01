export function isAbortErrorName(name: string | undefined): boolean {
  return name === 'MessageAbortedError' || name === 'AbortError';
}

export function createAbortSuppressor(suppressAfterMs: number) {
  let suppressUntil = 0;
  return {
    suppress(): void {
      suppressUntil = Date.now() + suppressAfterMs;
    },
    isSuppressed(): boolean {
      return Date.now() < suppressUntil;
    },
  };
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return isAbortErrorName(error.name);
  if (error instanceof Error) return isAbortErrorName(error.name);
  return false;
}
