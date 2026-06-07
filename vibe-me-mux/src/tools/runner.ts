import { randomUUID } from "node:crypto";
import type { JsonSchema, PluginToolArgs, RunnerToolArgs, ToolDefinition } from "../types/contract.js";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/contract.js";
import type { HostDependencies } from "../types/deps.js";
import { execute, cleanupJob, globalJobRegistry } from "engine/runner";
import { RUNNER_SUB_AGENT_DISABLED_TOOLS } from "../agentToolPolicies.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: ["shell", "python"],
      description: "Execution language",
    },
    program: {
      type: "string",
      description:
        "The program to execute. Can be a shell command or Python code depending on language. Supports both quick synchronous execution and long-running background tasks.",
    },
    dependencies: {
      type: "array",
      items: {
        type: "string",
        description: "Python dependency package name",
      },
      description: "Python dependencies to install (only for python language).",
    },
    what_to_summarize: {
      type: "string",
      description: "What to look for in the output. Be specific.",
    },
  },
  required: ["language", "program", "what_to_summarize"],
  additionalProperties: false,
};

export function createRunnerTool(_deps: HostDependencies): ToolDefinition {
  return {
    name: "runner",
    description:
      "Execute a shell command or Python program and delegate output summarization to a sub-agent. " +
      "Supports quick synchronous execution and long-running background tasks. " +
      "Automatically handles timeout management and provides incremental output monitoring.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as RunnerToolArgs;
      const workspaceId = requireWorkspaceId(config, "runner");
      const jobId = `${workspaceId}/${randomUUID()}`;
      const taskService = requireTaskService(config, "runner");
      const execResult = await execute({
        sessionId: jobId,
        parentSessionId: workspaceId,
        program: a.program,
        language: a.language ?? "shell",
        dependencies: a.dependencies,
        cwd: config.cwd,
      });

      const depInfo = a.dependencies?.length
        ? `Dependencies: ${a.dependencies.join(", ")}`
        : "";

      const prompt = execResult.background
        ? [
            `The following ${a.language ?? "shell"} program has been executed.`,
            "",
            "任务已转入后台。",
            "",
            "Program:",
            a.program,
            depInfo && `\n${depInfo}`,
            "",
            `What to summarize: ${a.what_to_summarize}`,
            "",
            `Initial output (first 5 seconds):`,
            execResult.output,
            "",
            `Job ID: ${execResult.jobId}`,
            "",
            "You can use runner_wait to check for new output from the running process " +
              "by passing the above jobId. Make sure to keep waiting until the task completes.",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `The following ${a.language ?? "shell"} program has been executed.`,
            "",
            "Task completed.",
            "",
            "Program:",
            a.program,
            depInfo && `\n${depInfo}`,
            "",
            `What to summarize: ${a.what_to_summarize}`,
            "",
            "Execution output:",
            execResult.output,
          ]
            .filter(Boolean)
            .join("\n");

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        prompt,
        title: "Runner",
        experiments: {
          subagentRole: "runner",
          toolPolicy: {
             disabledTools: [...RUNNER_SUB_AGENT_DISABLED_TOOLS],
          },
        },
      });

      if (!createResult.success) {
        cleanupJob(jobId);
        return `Failed to create runner task: ${createResult.error}`;
      }

      const job = globalJobRegistry.get(jobId);
      if (job) job.taskId = createResult.data.taskId;

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
          return `Runner task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        cleanupJob(jobId);
        const partial = execResult.background
          ? "\n\nPartial output before abort:\n" + execResult.output
          : "";
        return `Runner task was aborted.${partial}`;
      }
    },
  };
}
