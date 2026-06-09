import type { MuxPluginToolPolicy } from "./types/tool.js";

export type ToolSelector = string | readonly string[];

export const selectTools = (...selectors: readonly ToolSelector[]): string[] => selectors.flatMap((selector) => (
  typeof selector === "string" ? [selector] : [...selector]
));

export function toolPolicy(
  addSelectors: readonly ToolSelector[],
  removeSelectors: readonly ToolSelector[],
): MuxPluginToolPolicy {
  return {
    add: selectTools(...addSelectors),
    remove: selectTools(...removeSelectors),
  };
}
