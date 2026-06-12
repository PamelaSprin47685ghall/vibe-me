export type None = { readonly _tag: 'None' };
export type Some<T> = { readonly _tag: 'Some'; readonly value: T };
export type Maybe<T> = None | Some<T>;

export function some<T>(value: T): Some<T> {
  return { _tag: 'Some', value };
}

export const none: None = { _tag: 'None' };

export function matchMaybe<T, R>(
  value: Maybe<T>,
  patterns: { readonly None: () => R; readonly Some: (value: T) => R },
): R {
  if (value._tag === 'None') return patterns.None();
  return patterns.Some(value.value);
}

export type Ok<T> = { readonly _tag: 'Ok'; readonly value: T };
export type Err<E> = { readonly _tag: 'Err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { _tag: 'Ok', value };
}

export function err<E>(error: E): Err<E> {
  return { _tag: 'Err', error };
}

export function matchResult<T, E, R>(
  result: Result<T, E>,
  patterns: { readonly Ok: (value: T) => R; readonly Err: (error: E) => R },
): R {
  if (result._tag === 'Ok') return patterns.Ok(result.value);
  return patterns.Err(result.error);
}

export function assertNever(_: never): never {
  throw new Error('Unreachable state');
}
