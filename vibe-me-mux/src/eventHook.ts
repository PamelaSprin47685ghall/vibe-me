import type { JobRegistry } from "engine/runner";
import type { NudgeInputContext } from "engine/todo";
import type { PluginEvent, PluginEventHelpers, PluginEventHook } from "./types/tool.js";
import {
  extractLastAssistantMessage,
  selectNudgePrompt,
  createStreamEndState,
  type StreamEndState,
} from "./eventHook/stream-end.js";

export interface EventHookDeps {
  cleanupRegistry: (registry: JobRegistry, id: string) => void;
  globalJobRegistry: JobRegistry;
  deactivateReview: (id: string) => void;
  isReviewActive: (id: string) => boolean;
  clearIteratorScope: (id: string) => void;
  coordinator: {
    shouldNudge: (sessionId: string, context: NudgeInputContext) => string;
    suppress: (id: string) => void;
  };
  hasActiveJob: (sessionId: string) => boolean;
  buildRunnerNudgePrompt: () => string;
  TODO_NUDGE_PROMPT: string;
  LOOP_NUDGE_PROMPT: string;
}

async function handleStreamEnd(
  state: StreamEndState,
  deps: EventHookDeps,
  event: PluginEvent,
  helpers: PluginEventHelpers | undefined,
  workspaceId: string,
): Promise<void> {
  const muxStopReason = (event.properties as { metadata?: { muxStopReason?: string } } | undefined)?.metadata
    ?.muxStopReason;
  if (muxStopReason === "queued-message") return;
  if (!helpers) return;

  const parts = (event.properties as { parts?: Array<{ type: string; text?: string }> })?.parts ?? [];
  const lastAssistantMessage = extractLastAssistantMessage(parts);
  const hasActiveRunner = deps.hasActiveJob(workspaceId);

  if (!hasActiveRunner) {
    state.runnerNudgedWorkspaces.delete(workspaceId);
    state.lastNudgeSignature.delete(workspaceId);
  }

  if (state.stoppedWorkspaces.has(workspaceId)) return;

  const prompts = {
    todo: deps.TODO_NUDGE_PROMPT,
    loop: deps.LOOP_NUDGE_PROMPT,
    runner: deps.buildRunnerNudgePrompt,
  };

  if (hasActiveRunner) {
    const action = deps.coordinator.shouldNudge(workspaceId, {
      todos: [],
      lastAssistantMessage,
      hasActiveRunner: true,
      isLoopActive: false,
    });
    if (action !== "nudge-runner" || state.runnerNudgedWorkspaces.has(workspaceId)) return;

    const signature = `runner:${lastAssistantMessage.slice(0, 200)}`;
    if (state.lastNudgeSignature.get(workspaceId) === signature) return;
    try {
      if (await helpers.nudge(workspaceId, deps.buildRunnerNudgePrompt())) {
        state.runnerNudgedWorkspaces.add(workspaceId);
        state.lastNudgeSignature.set(workspaceId, signature);
        state.deliveredCounts.set(workspaceId, (state.deliveredCounts.get(workspaceId) ?? 0) + 1);
      }
    } catch {}
    return;
  }

  let todos: readonly string[];
  try {
    todos = (await helpers.getTodos(workspaceId)) ?? [];
  } catch {
    return;
  }

  const action = deps.coordinator.shouldNudge(workspaceId, {
    todos,
    lastAssistantMessage,
    hasActiveRunner,
    isLoopActive: deps.isReviewActive(workspaceId),
  });
  const promptText = selectNudgePrompt(action, prompts);
  if (!promptText) return;

  const signature = `${todos.length}:${lastAssistantMessage.slice(0, 200)}`;
  if (state.lastNudgeSignature.get(workspaceId) === signature) return;

  try {
    await helpers.nudge(workspaceId, promptText);
    state.lastNudgeSignature.set(workspaceId, signature);
    state.deliveredCounts.set(workspaceId, (state.deliveredCounts.get(workspaceId) ?? 0) + 1);
  } catch {}
}

export function createEventHook(deps: EventHookDeps): PluginEventHook {
  const state = createStreamEndState();

  return async (event, helpers) => {
    const { type, workspaceId } = event;
    if (!workspaceId) return;

    switch (type) {
      case "stream-end":
        await handleStreamEnd(state, deps, event, helpers, workspaceId);
        break;
      case "stream-abort":
        deps.cleanupRegistry(deps.globalJobRegistry, workspaceId);
        deps.deactivateReview(workspaceId);
        deps.clearIteratorScope(workspaceId);
        state.runnerNudgedWorkspaces.delete(workspaceId);
        state.stoppedWorkspaces.add(workspaceId);
        state.retryPendingWorkspaces.delete(workspaceId);
        break;
      case "error":
        if ((event.properties as { readonly errorType?: string } | undefined)?.errorType === "aborted") {
          deps.coordinator.suppress(workspaceId);
          state.stoppedWorkspaces.add(workspaceId);
        }
        break;
    }
  };
}
