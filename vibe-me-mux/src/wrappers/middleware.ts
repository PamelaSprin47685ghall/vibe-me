import type { ToolLike } from "../types/contract.js";

export type ToolExecuteFn = (...args: readonly unknown[]) => unknown;

export type ToolMiddleware = (next: ToolExecuteFn, tool: ToolLike) => ToolExecuteFn;

export function wrapExecute(tool: ToolLike, middleware: ToolMiddleware): ToolLike {
  const originalExecute = tool.execute;
  if (typeof originalExecute !== "function") return tool;

  const boundNext = originalExecute.bind(tool) as ToolExecuteFn;
  return { ...tool, execute: middleware(boundNext, tool) };
}

export function mapResult(
  mapper: (result: unknown, args: readonly unknown[]) => unknown | Promise<unknown>,
): ToolMiddleware {
  return (next) =>
    ((...args: readonly unknown[]) => {
      const result = next(...args);
      if (result instanceof Promise) {
        return result.then((resolved) => mapper(resolved, args));
      }
      return mapper(result, args);
    }) as ToolExecuteFn;
}
