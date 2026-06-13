import type { ReviewStore } from "engine/review";
import type { PluginSlashCommandDefinition } from "../../types/tool.js";
import { formatPreReviewResult } from "./format.js";
import { resolveLoopReviewDeps } from "./deps.js";
import { runPreReview } from "./pre-review.js";
import { validateTaskInput } from "./validation.js";
import type { LoopReviewDeps, PreReviewOutcome } from "./types.js";

function toOutcome(taskService: unknown): PreReviewOutcome {
  return taskService
    ? { _tag: "Passed" }
    : { _tag: "Skipped", reason: "noTaskService" };
}

export function createLoopReviewCommand(
  deps: LoopReviewDeps = {},
  reviewStore: ReviewStore,
): PluginSlashCommandDefinition {
  const resolvedDeps = resolveLoopReviewDeps(deps);
  return {
    key: "loop-review",
    description:
      "Pre-review task description with a reviewer sub-agent, then activate review loop mode.",
    inputHint: "<task description>",
    async execute(workspaceId, args) {
      const task = args.trim();
      const earlyMessage = validateTaskInput(task, reviewStore, workspaceId);
      if (earlyMessage) return earlyMessage;

      const outcome = resolvedDeps.taskService
        ? await runPreReview(task, resolvedDeps, workspaceId)
        : toOutcome(resolvedDeps.taskService);
      reviewStore.activateReview(workspaceId, task, resolvedDeps.now());
      return formatPreReviewResult(task, outcome, resolvedDeps.buildLoopMessage);
    },
  };
}
