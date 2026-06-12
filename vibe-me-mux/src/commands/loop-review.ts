import type { ReviewStore } from "engine/review";
import type { PluginSlashCommandDefinition } from "../types/tool.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import type { DelegateOptions } from "../tools/delegate.js";
import { delegateToSubAgent } from "../tools/delegate.js";
import { isPassingReviewReport } from "../tools/submitReview.js";
import { deniedToolsFor } from "../tools/policy.js";
import { buildLoopMessage } from "./loop-message.js";

const DEFAULT_PRE_REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

type DelegateToSubAgent = (
  config: PluginToolConfiguration,
  agentId: string,
  prompt: string,
  title: string,
  options?: DelegateOptions,
) => Promise<string>;

type BuildLoopMessage = (task: string, ...bodyLines: string[]) => string;

export interface LoopReviewDeps {
  readonly delegateToSubAgent?: DelegateToSubAgent;
  readonly buildLoopMessage?: BuildLoopMessage;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly taskService?: HostDependencies["taskService"];
  readonly hostDeps?: HostDependencies;
}

interface ResolvedLoopReviewDeps extends LoopReviewDeps {
  readonly delegateToSubAgent: DelegateToSubAgent;
  readonly buildLoopMessage: BuildLoopMessage;
  readonly now: () => number;
  readonly timeoutMs: number;
}

function buildReviewPrompt(task: string): string {
  return [
    "You are a reviewer evaluating whether a task description is clear and actionable enough to begin work.",
    "",
    "=== Task Description ===",
    "",
    task,
    "",
    "Evaluate the task description above. If it is clear, specific, and actionable, respond with exactly: PASS",
    "If the task description has issues (ambiguous, missing requirements, contradictory), provide specific, actionable feedback.",
  ].join("\n");
}

function createDefaultDelegate(hostDeps: HostDependencies): DelegateToSubAgent {
  return (config, agentId, prompt, title, options) =>
    delegateToSubAgent(config, hostDeps, agentId, prompt, title, options);
}

function resolveLoopReviewDeps(deps: LoopReviewDeps): ResolvedLoopReviewDeps {
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

function validateTaskInput(
  task: string,
  reviewStore: ReviewStore,
  workspaceId: string,
): string | null {
  if (!task) {
    reviewStore.deactivateReview(workspaceId);
    return "Loop mode cancelled.";
  }
  if (reviewStore.isReviewActive(workspaceId)) {
    return "Loop mode is already active. Submit your work via submit_review.";
  }
  return null;
}

async function runPreReview(
  task: string,
  deps: ResolvedLoopReviewDeps,
  workspaceId: string,
): Promise<string> {
  const config: PluginToolConfiguration = {
    cwd: process.cwd(),
    workspaceId,
    taskService: deps.taskService,
  };
  const reviewPrompt = buildReviewPrompt(task);
  try {
    return await Promise.race([
      deps.delegateToSubAgent(config, "explore", reviewPrompt, "Pre-review", {
        aiSettingsAgentId: "plan",
        experiments: {
          subagentRole: "reviewer",
          toolPolicy: { disabledTools: deniedToolsFor("reviewer") },
        },
      }),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("PASS"), deps.timeoutMs),
      ),
    ]);
  } catch {
    return "PASS";
  }
}

function formatPreReviewResult(
  task: string,
  report: string,
  buildLoopMessage: BuildLoopMessage,
): string {
  if (isPassingReviewReport(report)) {
    return buildLoopMessage(
      task,
      "Loop mode is active. Pre-review passed. Complete the task above, then call submit_review with:",
    );
  }
  return buildLoopMessage(
    task,
    "Pre-review feedback:",
    "",
    report,
    "",
    "Loop mode is active. Address the pre-review feedback above while completing the task. Then call submit_review with:",
  );
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

      if (!resolvedDeps.taskService) {
        reviewStore.activateReview(workspaceId, task, resolvedDeps.now());
        return resolvedDeps.buildLoopMessage(
          task,
          "Loop mode is active (pre-review unavailable — no task service). Complete the task above, then call submit_review with:",
        );
      }

      const preReviewReport = await runPreReview(
        task,
        resolvedDeps,
        workspaceId,
      );
      reviewStore.activateReview(workspaceId, task, resolvedDeps.now());
      return formatPreReviewResult(
        task,
        preReviewReport,
        resolvedDeps.buildLoopMessage,
      );
    },
  };
}
