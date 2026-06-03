export function isAbortErrorName(name: string | undefined): boolean {
  return name === 'MessageAbortedError' || name === 'AbortError';
}

export interface AbortSuppressor {
  signal: AbortSignal;
  suppress: () => void;
  restore: () => void;
  isSuppressed: () => boolean;
}

export function createAbortSuppressor(suppressAfterMs: number): AbortSuppressor {
  let suppressUntil = 0;
  return {
    signal: new AbortController().signal,
    suppress(): void {
      suppressUntil = Date.now() + suppressAfterMs;
    },
    restore(): void {
      suppressUntil = 0;
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
