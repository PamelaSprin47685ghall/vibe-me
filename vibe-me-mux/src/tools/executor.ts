import { TOOL_COPY } from "engine/tool-copy";
import { randomUUID } from "node:crypto";
import {
  execute,
  shouldSummarize,
  buildExecutorSummaryPrompt,
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  type ExecutorLanguage,
  type ExecutorTimeoutType,
  type ExecuteOptions,
  type ExecuteResult,
} from "engine/executor";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireWorkspaceId } from "../types/contract.js";
import { isForegroundWaitBackgroundedError } from "./submitReview.js";
import type { HostDependencies, TaskCreateResult, TaskServiceLike } from "../types/deps.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";
import type { ResolvedDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";
import { CANONICAL_TOOL_NAMES } from "engine/agent-policy";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: ["shell", "python", "javascript"],
      description: TOOL_COPY.executor.params.language,
    },
    program: {
      type: "string",
      description: TOOL_COPY.executor.params.program,
    },
    dependencies: {
      type: "array",
      items: {
        type: "string",
        description: "Python dependency package name",
      },
      description: TOOL_COPY.executor.params.dependencies,
    },
    timeout_type: {
      type: "string",
      enum: ["short", "long"],
      description: TOOL_COPY.executor.params.timeout_type,
    },
  },
  required: ["language", "program", "timeout_type"],
  additionalProperties: false,
};

const SUMMARIZER_DISABLED_TOOLS: readonly string[] = [
  ...CANONICAL_TOOL_NAMES,
  "read",
  "write",
  "edit",
  "bash",
  "bash_.*",
  "task",
  "task_.*",
  "patch",
  "fetch",
  "fetch_.*",
  "webfetch",
  "webfetch_.*",
  "websearch",
  "websearch_.*",
  "stealth_browser_mcp_.*",
];

interface RawExecutorArgs {
  language: unknown;
  program: unknown;
  dependencies?: unknown;
  timeout_type: unknown;
}

interface ValidatedExecutorArgs {
  program: string;
  language: ExecutorLanguage;
  dependencies: string[] | undefined;
  timeoutType: ExecutorTimeoutType;
}

function isExecutorLanguage(value: unknown): value is ExecutorLanguage {
  return value === "shell" || value === "python" || value === "javascript";
}

function isExecutorTimeoutType(value: unknown): value is ExecutorTimeoutType {
  return value === "short" || value === "long";
}

export interface ExecutorToolDeps {
  execute: typeof execute;
  resolveAiSettings?: (
    config: PluginToolConfiguration,
    agentId: string,
  ) => Promise<ResolvedDelegatedAgentAiSettings>;
}

function validateExecutorArgs(args: unknown): ValidatedExecutorArgs {
  const a = args as RawExecutorArgs;
  if (typeof a.program !== "string") throw new Error("executor: 'program' must be a string");
  if (!isExecutorLanguage(a.language)) {
    throw new Error("executor: 'language' must be one of shell, python, javascript");
  }
  if (!isExecutorTimeoutType(a.timeout_type)) {
    throw new Error("executor: 'timeout_type' must be 'short' or 'long'");
  }
  const dependencies = Array.isArray(a.dependencies)
    ? a.dependencies.filter((dep): dep is string => typeof dep === "string")
    : undefined;
  return { program: a.program, language: a.language, dependencies, timeoutType: a.timeout_type };
}

function buildExecutorOptions(args: ValidatedExecutorArgs, cwd: string | undefined): ExecuteOptions {
  return {
    program: args.program,
    language: args.language,
    dependencies: args.dependencies,
    timeoutType: args.timeoutType,
    cwd,
  };
}

function buildSessionId(workspaceId: string): string {
  return `${workspaceId}/${randomUUID()}`;
}

function buildSummaryPrompt(args: ValidatedExecutorArgs, execResult: ExecuteResult): string {
  return `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}\n\n${buildExecutorSummaryPrompt(
    {
      program: args.program,
      language: args.language,
      dependencies: args.dependencies,
      timeoutType: args.timeoutType,
    },
    execResult,
  )}`;
}

async function createSummaryTask(
  taskService: TaskServiceLike,
  workspaceId: string,
  args: ValidatedExecutorArgs,
  execResult: ExecuteResult,
  aiSettings: ResolvedDelegatedAgentAiSettings,
): Promise<TaskCreateResult> {
  return taskService.create({
    parentWorkspaceId: workspaceId,
    kind: "agent",
    agentId: "explore",
    ...(aiSettings.modelString != null && { modelString: aiSettings.modelString }),
    ...(aiSettings.thinkingLevel != null && { thinkingLevel: aiSettings.thinkingLevel }),
    prompt: buildSummaryPrompt(args, execResult),
    title: "Executor summary",
    experiments: {
      subagentRole: "summarizer",
      toolPolicy: { disabledTools: SUMMARIZER_DISABLED_TOOLS },
    },
  });
}

async function waitForSummaryReport(
  taskService: TaskServiceLike,
  taskId: string,
  workspaceId: string,
  rawOutput: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  try {
    const result = await taskService.waitForAgentReport(taskId, {
      requestingWorkspaceId: workspaceId,
      abortSignal,
      backgroundOnMessageQueued: false,
    });
    return result.reportMarkdown;
  } catch (error) {
    if (isForegroundWaitBackgroundedError(error)) {
      return `Executor summarizer task (${taskId}) moved to background. Raw output retained below.\n\n${rawOutput}`;
    }
    throw error;
  }
}

async function summarizeOutput(
  args: ValidatedExecutorArgs,
  execResult: ExecuteResult,
  config: PluginToolConfiguration,
  workspaceId: string,
  resolveAiSettings: NonNullable<ExecutorToolDeps["resolveAiSettings"]>,
): Promise<string> {
  if (!config.taskService) {
    return `[executor] Output exceeded ${execResult.output.length} bytes but no taskService is available to summarize. Raw output:\n\n${execResult.output}`;
  }
  const aiSettings = await resolveAiSettings(config, "explore");
  const createResult = await createSummaryTask(config.taskService, workspaceId, args, execResult, aiSettings);
  if (!createResult.success) {
    return `[executor] Failed to create summarizer task: ${createResult.error}\n\nRaw output:\n${execResult.output}`;
  }
  return waitForSummaryReport(
    config.taskService,
    createResult.data.taskId,
    workspaceId,
    execResult.output,
    config.abortSignal,
  );
}

export function createExecutorTool(deps: HostDependencies, executorDeps: ExecutorToolDeps): ToolDefinition {
  const resolveAiSettings = executorDeps.resolveAiSettings ?? createResolveDelegatedAgentAiSettings(deps);

  return {
    name: "executor",
    description: TOOL_COPY.executor.description,
    parameters,
    execute: async (config, args) => {
      const validated = validateExecutorArgs(args);
      const workspaceId = requireWorkspaceId(config, "executor");
      const execResult = await executorDeps.execute(
        buildExecutorOptions(validated, config.cwd),
        buildSessionId(workspaceId),
      );
      if (!shouldSummarize(execResult.output)) return execResult.output;
      return summarizeOutput(validated, execResult, config, workspaceId, resolveAiSettings);
    },
  };
}
