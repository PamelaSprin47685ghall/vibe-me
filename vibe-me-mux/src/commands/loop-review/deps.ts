import { delegateToSubAgent } from "../../tools/delegate.js";
import type { HostDependencies } from "../../types/deps.js";
import { buildLoopMessage } from "../loop-message.js";
import type { LoopReviewDeps, ResolvedLoopReviewDeps } from "./types.js";

const DEFAULT_PRE_REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

function createDefaultDelegate(hostDeps: HostDependencies): ResolvedLoopReviewDeps["delegateToSubAgent"] {
  return (config, agentId, prompt, title, options) =>
    delegateToSubAgent(config, hostDeps, agentId, prompt, title, options);
}

export function resolveLoopReviewDeps(deps: LoopReviewDeps): ResolvedLoopReviewDeps {
  const hostDeps = deps.hostDeps;
  return {
    ...deps,
    delegateToSubAgent:
      deps.delegateToSubAgent ??
      (hostDeps
        ? createDefaultDelegate(hostDeps)
        : () => {
            throw new Error("delegateToSubAgent not provided and no hostDeps");
          }),
    buildLoopMessage: deps.buildLoopMessage ?? buildLoopMessage,
    now: deps.now ?? Date.now,
    timeoutMs: deps.timeoutMs ?? DEFAULT_PRE_REVIEW_TIMEOUT_MS,
    taskService: deps.taskService ?? hostDeps?.taskService,
  };
}
