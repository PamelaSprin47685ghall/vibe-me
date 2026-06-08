import { globalIteratorStore } from "engine/util";
import { deactivateReview, isReviewActive } from "engine/review";
import { cleanupJob, getActiveJobs, hasActiveJob, buildRunnerNudgePrompt } from "engine/runner";
import { defaultCoordinator, TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, type NudgeInputContext } from "engine/todo";
import type { PluginEventHook } from "./types/tool.js";

export function createEventHook(): PluginEventHook {
  const runnerNudgedWorkspaces = new Set<string>();
  const stoppedWorkspaces = new Set<string>();
  const retryPendingWorkspaces = new Set<string>();
  const deliveredCounts = new Map<string, number>();
  const lastNudgeSignature = new Map<string, string>();

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
          lastNudgeSignature.delete(workspaceId);
        }

        if (stoppedWorkspaces.has(workspaceId)) break;

        if (hasActiveRunner) {
          const context: NudgeInputContext = {
            todos: [],
            lastAssistantMessage,
            hasActiveRunner: true,
            isLoopActive: false,
          };
          const action = defaultCoordinator.shouldNudge(workspaceId, context);

          if (action === "nudge-runner" && !runnerNudgedWorkspaces.has(workspaceId)) {
            const signature = `runner:${lastAssistantMessage.slice(0, 200)}`;
            if (lastNudgeSignature.get(workspaceId) === signature) break;
            try {
              if (await helpers.nudge(workspaceId, buildRunnerNudgePrompt())) {
                runnerNudgedWorkspaces.add(workspaceId);
                lastNudgeSignature.set(workspaceId, signature);
                deliveredCounts.set(workspaceId, (deliveredCounts.get(workspaceId) ?? 0) + 1);
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

        const signature = `${todos.length}:${lastAssistantMessage.slice(0, 200)}`;
        if (lastNudgeSignature.get(workspaceId) === signature) break;

        try {
          await helpers.nudge(workspaceId, promptText);
          lastNudgeSignature.set(workspaceId, signature);
          deliveredCounts.set(workspaceId, (deliveredCounts.get(workspaceId) ?? 0) + 1);
        } catch {}
        break;
      }
      case "stream-abort":
        cleanupJob(workspaceId);
        deactivateReview(workspaceId);
        globalIteratorStore.clearScope(workspaceId);
        runnerNudgedWorkspaces.delete(workspaceId);
        stoppedWorkspaces.add(workspaceId);
        retryPendingWorkspaces.delete(workspaceId);
        break;
      case "error":
        if ((event.properties as { readonly errorType?: string } | undefined)?.errorType === "aborted") {
          defaultCoordinator.suppress(workspaceId);
          stoppedWorkspaces.add(workspaceId);
        }
        break;
    }
  };
}
