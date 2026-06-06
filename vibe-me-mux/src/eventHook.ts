import { createAbortSuppressor, globalIteratorStore } from "engine/util";
import { deactivateReview, isReviewActive } from "engine/review";
import { cleanupJob, getActiveJobs, hasActiveJob, buildRunnerNudgePrompt } from "engine/runner";
import { defaultCoordinator, TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, type NudgeInputContext } from "engine/todo";
import type { PluginEventHook } from "./types/tool.js";

export function createEventHook(): PluginEventHook {
  const suppressors = new Map<string, ReturnType<typeof createAbortSuppressor>>();

  return async (event, helpers) => {
    const { type, workspaceId } = event;
    if (!workspaceId) return;

    switch (type) {
      case "stream-end": {
        if (!helpers) break;
        const parts = (event.properties as { parts?: Array<{ type: string; text?: string }> })?.parts ?? [];
        const lastAssistantMessage = parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!)
          .join("\n");

        let todos: Array<{ status: string }>;
        try {
          todos = await helpers.getTodos(workspaceId);
        } catch {
          break;
        }

        const context: NudgeInputContext = {
          todos,
          lastAssistantMessage,
          hasActiveRunner: hasActiveJob(getActiveJobs, workspaceId),
          isLoopActive: isReviewActive(workspaceId),
        };

        const action = defaultCoordinator.shouldNudge(workspaceId, context);
        if (action === "none") break;

        let promptText: string;
        if (action === "nudge-todo") {
          promptText = TODO_NUDGE_PROMPT;
        } else if (action === "nudge-loop") {
          promptText = LOOP_NUDGE_PROMPT;
        } else {
          promptText = buildRunnerNudgePrompt();
        }

        try {
          await helpers.nudge(workspaceId, promptText);
        } catch {
          // nudge send failed — best effort
        }
        break;
      }
      case "stream-abort":
        cleanupJob(workspaceId);
        deactivateReview(workspaceId);
        globalIteratorStore.clearScope(workspaceId);
        suppressors.delete(workspaceId);
        break;
      case "error":
        if ((event.properties as { readonly errorType?: string } | undefined)?.errorType === "aborted") {
          let sup = suppressors.get(workspaceId);
          if (!sup) {
            sup = createAbortSuppressor(30_000);
            suppressors.set(workspaceId, sup);
          }
          sup.suppress();
        }
        break;
    }
  };
}
