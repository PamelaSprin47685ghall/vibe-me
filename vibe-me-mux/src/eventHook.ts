import { globalIteratorStore } from "engine/util";
import { deactivateReview, isReviewActive } from "engine/review";
import { cleanupJob, getActiveJobs, hasActiveJob, buildRunnerNudgePrompt } from "engine/runner";
import { defaultCoordinator, TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, type NudgeInputContext } from "engine/todo";
import type { PluginEventHook } from "./types/tool.js";

export function createEventHook(): PluginEventHook {
  const runnerNudgedWorkspaces = new Set<string>();

  return async (event, helpers) => {
    const { type, workspaceId } = event;
    if (!workspaceId) return;

    switch (type) {
      case "stream-end": {
        const muxStopReason = (event.properties as { metadata?: { muxStopReason?: string } } | undefined)?.metadata
          ?.muxStopReason;
        if (muxStopReason === "queued-message") break;

        if (!helpers) break;

        const parts = (event.properties as { parts?: Array<{ type: string; text?: string }> })?.parts ?? [];
        const lastAssistantMessage = parts
          .filter((part) => part.type === "text" && part.text)
          .map((part) => part.text!)
          .join("\n");
        const hasActiveRunner = hasActiveJob(getActiveJobs, workspaceId);

        if (!hasActiveRunner) {
          runnerNudgedWorkspaces.delete(workspaceId);
        }

        if (hasActiveRunner) {
          const context: NudgeInputContext = {
            todos: [],
            lastAssistantMessage,
            hasActiveRunner: true,
            isLoopActive: false,
          };
          const action = defaultCoordinator.shouldNudge(workspaceId, context);

          if (action === "nudge-runner" && !runnerNudgedWorkspaces.has(workspaceId)) {
            try {
              if (await helpers.nudge(workspaceId, buildRunnerNudgePrompt())) {
                runnerNudgedWorkspaces.add(workspaceId);
              }
            } catch {}
          }

          break;
        }

        let todos: Array<{ status: string }>;
        try {
          todos = await helpers.getTodos(workspaceId);
        } catch {
          break;
        }

        const context: NudgeInputContext = {
          todos,
          lastAssistantMessage,
          hasActiveRunner,
          isLoopActive: isReviewActive(workspaceId),
        };

        const action = defaultCoordinator.shouldNudge(workspaceId, context);
        const promptText =
          action === "nudge-todo"
            ? TODO_NUDGE_PROMPT
            : action === "nudge-loop"
              ? LOOP_NUDGE_PROMPT
              : action === "nudge-runner"
                ? buildRunnerNudgePrompt()
                : null;
        if (!promptText) break;

        try {
          await helpers.nudge(workspaceId, promptText);
        } catch {}
        break;
      }
      case "stream-abort":
        cleanupJob(workspaceId);
        deactivateReview(workspaceId);
        globalIteratorStore.clearScope(workspaceId);
        runnerNudgedWorkspaces.delete(workspaceId);
        break;
      case "error":
        if ((event.properties as { readonly errorType?: string } | undefined)?.errorType === "aborted") {
          defaultCoordinator.suppress(workspaceId);
        }
        break;
    }
  };
}
