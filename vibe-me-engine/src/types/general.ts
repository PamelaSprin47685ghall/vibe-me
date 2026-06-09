export type None = { readonly _tag: 'None' };
export type Some<T> = { readonly _tag: 'Some'; readonly value: T };
export type Maybe<T> = None | Some<T>;

/** Pure constructor. */
export function some<T>(value: T): Some<T> {
  return { _tag: 'Some', value };
}

/** Singleton `None` value. */
export const none: None = { _tag: 'None' };

/** Exhaustive match for `Maybe<T>`. */
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

/** Pure constructor. */
export function ok<T>(value: T): Ok<T> {
  return { _tag: 'Ok', value };
}

/** Pure constructor. */
export function err<E>(error: E): Err<E> {
  return { _tag: 'Err', error };
}

/** Exhaustive match for `Result<T, E>`. */
export function matchResult<T, E, R>(
  result: Result<T, E>,
  patterns: { readonly Ok: (value: T) => R; readonly Err: (error: E) => R },
): R {
  if (result._tag === 'Ok') return patterns.Ok(result.value);
  return patterns.Err(result.error);
}

/** Unwrap a value or throw — only for use after exhaustive checks in tests. */
export function unsafeUnwrapOk<T>(result: Result<T, unknown>): T {
  if (result._tag === 'Err') throw new Error('Called unsafeUnwrapOk on Err');
  return result.value;
}

/** Unwrap a value from `Some` or throw. */
export function unsafeUnwrapSome<T>(value: Maybe<T>): T {
  if (value._tag === 'None') throw new Error('Called unsafeUnwrapSome on None');
  return value.value;
}
