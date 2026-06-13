import { type Result, ok, err } from 'engine';

export function requireString(args: Record<string, unknown>, key: string): Result<string, string> {
  const value = args[key];
  if (typeof value !== 'string') return err(`${key} must be a string`);
  return ok(value);
}

export function optionalString(args: Record<string, unknown>, key: string): Result<string | undefined, string> {
  const value = args[key];
  if (value == null) return ok(undefined);
  if (typeof value !== 'string') return err(`${key} must be a string`);
  return ok(value);
}

export function requireNumber(args: Record<string, unknown>, key: string): Result<number, string> {
  const value = args[key];
  if (typeof value !== 'number') return err(`${key} must be a number`);
  return ok(value);
}

export function optionalNumber(args: Record<string, unknown>, key: string): Result<number | undefined, string> {
  const value = args[key];
  if (value == null) return ok(undefined);
  if (typeof value !== 'number') return err(`${key} must be a number`);
  return ok(value);
}

export function optionalBoolean(args: Record<string, unknown>, key: string): Result<boolean | undefined, string> {
  const value = args[key];
  if (value == null) return ok(undefined);
  if (typeof value !== 'boolean') return err(`${key} must be a boolean`);
  return ok(value);
}

export function requireStringArray(args: Record<string, unknown>, key: string): Result<readonly string[], string> {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return err(`${key} must be an array of strings`);
  }
  return ok(value);
}

export function requireIntentTuples(args: Record<string, unknown>, key: string): Result<[string, string[]][], string> {
  const value = args[key];
  if (!Array.isArray(value)) {
    return err(`${key} must be an array of [string, string[]] tuples`);
  }
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string' || !Array.isArray(item[1]) || item[1].some((tag) => typeof tag !== 'string')) {
      return err(`${key} must be an array of [string, string[]] tuples`);
    }
  }
  return ok(value as [string, string[]][]);
}
