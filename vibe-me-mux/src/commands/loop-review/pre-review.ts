import type { PluginToolConfiguration } from "../../types/tool.js";
import { deniedToolsFor } from "../../tools/policy.js";
import { isPassingReviewReport } from "../../tools/submitReview.js";
import { buildReviewPrompt } from "./prompt.js";
import type { PreReviewOutcome, ResolvedLoopReviewDeps } from "./types.js";

export async function runPreReview(
  task: string,
  deps: ResolvedLoopReviewDeps,
  workspaceId: string,
): Promise<PreReviewOutcome> {
  const config: PluginToolConfiguration = {
    cwd: process.cwd(),
    workspaceId,
    taskService: deps.taskService,
  };
  const reviewPrompt = buildReviewPrompt(task);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject({ _tag: "PreReviewTimedOut" as const }),
      deps.timeoutMs,
    ),
  );

  try {
    const report = await Promise.race([
      deps.delegateToSubAgent(config, "explore", reviewPrompt, "Pre-review", {
        aiSettingsAgentId: "plan",
        experiments: {
          subagentRole: "reviewer",
          toolPolicy: { disabledTools: deniedToolsFor("reviewer") },
        },
      }),
      timeout,
    ]);
    return isPassingReviewReport(report)
      ? { _tag: "Passed" }
      : { _tag: "Feedback", feedback: report };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "_tag" in error &&
      error._tag === "PreReviewTimedOut"
    ) {
      return { _tag: "Skipped", reason: "timedOut" };
    }
    return { _tag: "Skipped", reason: "subAgentFailed" };
  }
}
