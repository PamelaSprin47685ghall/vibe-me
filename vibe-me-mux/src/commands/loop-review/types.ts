import type { HostDependencies } from "../../types/deps.js";
import type { PluginToolConfiguration } from "../../types/tool.js";
import type { DelegateOptions } from "../../tools/delegate.js";

type DelegateToSubAgent = (
  config: PluginToolConfiguration,
  agentId: string,
  prompt: string,
  title: string,
  options?: DelegateOptions,
) => Promise<string>;

export type BuildLoopMessage = (task: string, ...bodyLines: string[]) => string;

export interface LoopReviewDeps {
  readonly delegateToSubAgent?: DelegateToSubAgent;
  readonly buildLoopMessage?: BuildLoopMessage;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly taskService?: HostDependencies["taskService"];
  readonly hostDeps?: HostDependencies;
}

export interface ResolvedLoopReviewDeps extends LoopReviewDeps {
  readonly delegateToSubAgent: DelegateToSubAgent;
  readonly buildLoopMessage: BuildLoopMessage;
  readonly now: () => number;
  readonly timeoutMs: number;
}

export type PreReviewOutcome =
  | { readonly _tag: "Passed" }
  | { readonly _tag: "Feedback"; readonly feedback: string }
  | { readonly _tag: "Skipped"; readonly reason: "timedOut" | "subAgentFailed" | "noTaskService" };
