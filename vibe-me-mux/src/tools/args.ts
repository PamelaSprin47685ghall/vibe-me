export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value == null) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

export function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number") throw new Error(`${key} must be a number`);
  return value;
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value == null) return undefined;
  if (typeof value !== "number") throw new Error(`${key} must be a number`);
  return value;
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value == null) return undefined;
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

export function requireStringArray(args: Record<string, unknown>, key: string): readonly string[] {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}
