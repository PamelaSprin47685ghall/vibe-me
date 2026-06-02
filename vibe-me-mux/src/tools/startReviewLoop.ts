import type { SchemaFactory, ToolDefinition, StartReviewLoopToolArgs, PluginToolArgs } from "../types/contract";
import type { HostDependencies } from "../types/deps";
import { requireWorkspaceId } from "../types/contract";
import { activateReview } from "engine/review";

export function createStartReviewLoopTool<S>(
  _deps: HostDependencies,
  f: SchemaFactory<S>,
): ToolDefinition<S> {
  const schema = f.object({
    task: f.string(
      "Description of the task/reason for entering review loop mode. This is recorded as the original task for review context.",
    ),
  });

  return {
    name: "start_review_loop",
    description:
      "Activate review loop mode for the current session. " +
      "When active, submit_review will create a reviewer sub-agent instead of skipping. " +
      "Use this when the user asks to enter review/loop mode, or when explicitly instructed to start a review loop. " +
      "Call this once at the beginning; the loop stays active until the session ends or is explicitly stopped.",
    schema,
    execute: async (config, args: PluginToolArgs) => {
      const { task } = args as StartReviewLoopToolArgs;
      const workspaceId = requireWorkspaceId(config, "start_review_loop");
      activateReview(workspaceId, task);
      return "Review loop activated. Use submit_review when you want your work reviewed.";
    },
  };
}
