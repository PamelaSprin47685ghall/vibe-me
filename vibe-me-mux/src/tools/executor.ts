import { TOOL_COPY } from "engine/tool-copy";
import { randomUUID } from "node:crypto";
import {
  execute,
  shouldSummarize,
  buildExecutorSummaryPrompt,
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  type ExecutorLanguage,
  type ExecutorTimeoutType,
} from "engine/executor";
import type { JsonSchema, ToolDefinition } from "../types/contract.js";
import { requireWorkspaceId } from "../types/contract.js";
import { isForegroundWaitBackgroundedError } from "./submitReview.js";
import type { HostDependencies } from "../types/deps.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";
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

function isExecutorLanguage(value: unknown): value is ExecutorLanguage {
  return value === "shell" || value === "python" || value === "javascript";
}

function isExecutorTimeoutType(value: unknown): value is ExecutorTimeoutType {
  return value === "short" || value === "long";
}

export interface ExecutorToolDeps {
  execute: typeof execute;
}

export function createExecutorTool(deps: HostDependencies, executorDeps: ExecutorToolDeps): ToolDefinition {
  const resolveDelegatedAgentAiSettings = createResolveDelegatedAgentAiSettings(deps);

  return {
    name: "executor",
    description: TOOL_COPY.executor.description,
    parameters,
    execute: async (config, args) => {
      const a = args as {
        language: unknown;
        program: unknown;
        dependencies?: unknown;
        timeout_type: unknown;
      };
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

      const workspaceId = requireWorkspaceId(config, "executor");
      const sessionId = `${workspaceId}/${randomUUID()}`;

      const execResult = await executorDeps.execute(
        {
          program: a.program,
          language: a.language,
          dependencies,
          timeoutType: a.timeout_type,
          cwd: config.cwd,
        },
        sessionId,
      );

      if (!shouldSummarize(execResult.output)) {
        return execResult.output;
      }

      const taskService = config.taskService;
      if (!taskService) {
        return `[executor] Output exceeded ${execResult.output.length} bytes but no taskService is available to summarize. Raw output:\n\n${execResult.output}`;
      }

      const prompt = `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}\n\n${buildExecutorSummaryPrompt(
        { program: a.program, language: a.language, dependencies, timeoutType: a.timeout_type },
        execResult,
      )}`;

      const aiSettings = await resolveDelegatedAgentAiSettings(config, "explore");
      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        ...(aiSettings?.modelString != null && { modelString: aiSettings.modelString }),
        ...(aiSettings?.thinkingLevel != null && { thinkingLevel: aiSettings.thinkingLevel }),
        prompt,
        title: "Executor summary",
        experiments: {
          subagentRole: "summarizer",
          toolPolicy: { disabledTools: SUMMARIZER_DISABLED_TOOLS },
        },
      });

      if (!createResult.success) {
        return `[executor] Failed to create summarizer task: ${createResult.error}\n\nRaw output:\n${execResult.output}`;
      }

      try {
        const result = await taskService.waitForAgentReport(
          createResult.data.taskId,
          {
            requestingWorkspaceId: workspaceId,
            abortSignal: config.abortSignal,
            backgroundOnMessageQueued: false,
          },
        );
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Executor summarizer task (${createResult.data.taskId}) moved to background. Raw output retained below.\n\n${execResult.output}`;
        }
        throw error;
      }
    },
  };
}
