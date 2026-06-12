import type { NudgeInputContext } from "engine/todo";
import type { ReviewStore } from "engine/review";
import { getPartsText } from "engine/util";
import type { PluginEvent, PluginEventHelpers, PluginEventHook } from "./types/tool.js";
import {
  selectNudgePrompt,
  createStreamEndState,
  type StreamEndState,
} from "./eventHook/stream-end.js";

export interface EventHookDeps {
  reviewStore: ReviewStore;
  clearIteratorScope: (id: string) => void;
  coordinator: {
    shouldNudge: (sessionId: string, context: NudgeInputContext, now: number) => string;
    suppress: (id: string) => void;
  };
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
  const lastAssistantMessage = getPartsText(parts) ?? "";

  state.lastNudgeSignature.delete(workspaceId);
  if (state.stoppedWorkspaces.has(workspaceId)) return;

  const prompts = {
    todo: deps.TODO_NUDGE_PROMPT,
    loop: deps.LOOP_NUDGE_PROMPT,
  };

  let todos: readonly string[];
  try {
    todos = (await helpers.getTodos(workspaceId)) ?? [];
  } catch {
    return;
  }

  const action = deps.coordinator.shouldNudge(workspaceId, {
    todos,
    lastAssistantMessage,
    hasActiveRunner: false,
    isLoopActive: deps.reviewStore.isReviewActive(workspaceId),
  }, Date.now());
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
        deps.reviewStore.deactivateReview(workspaceId);
        deps.clearIteratorScope(workspaceId);
        state.lastNudgeSignature.delete(workspaceId);
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
