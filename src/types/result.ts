export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } =>
  !r.ok;

export const mapResult = <T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;

export const flatMapResult = <T, U, E>(r: Result<T, E>, f: (v: T) => Result<U, E>): Result<U, E> =>
  r.ok ? f(r.value) : r;
