import type { PluginSlashCommandDefinition } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import { createLoopOnlyCommand } from "./loop-simple.js";
import { createLoopReviewCommand } from "./loop-review.js";

export function createLoopCommand(deps: HostDependencies): PluginSlashCommandDefinition[] {
  return [createLoopOnlyCommand(), createLoopReviewCommand(deps)];
}