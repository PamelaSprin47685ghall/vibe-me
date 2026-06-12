import type { PluginSlashCommandDefinition } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import type { ReviewStore } from "engine/review";
import { createLoopOnlyCommand } from "./loop-simple.js";
import { createLoopReviewCommand } from "./loop-review.js";

export function createLoopCommand(deps: HostDependencies, reviewStore: ReviewStore): PluginSlashCommandDefinition[] {
  return [
    createLoopOnlyCommand(reviewStore),
    createLoopReviewCommand({ hostDeps: deps }, reviewStore),
  ];
}