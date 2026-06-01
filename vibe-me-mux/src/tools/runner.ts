import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import type { ToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { execute, cleanupJob } from "engine/runner";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

const RunnerToolInputSchema = z.object({
  language: z.enum(["shell", "python"]).default("shell").describe("Execution language"),
  program: z
    .string()
    .describe(
      "The program to execute. Can be a shell command or Python code depending on language. Supports both quick synchronous execution and long-running background tasks.",
    ),
  dependencies: z
    .array(z.string())
    .optional()
    .describe("Python dependencies to install (only for python language)."),
  what_to_summarize: z
    .string()
    .describe("What to look for in the output. Be specific."),
});

export const createRunnerTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description:
      "Execute a shell command or Python program and delegate output summarization to a sub-agent. " +
      "Supports quick synchronous execution and long-running background tasks. " +
      "Automatically handles timeout management and provides incremental output monitoring.",
    inputSchema: RunnerToolInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "runner");
      const jobId = `${workspaceId}/${randomUUID()}`;
      const taskService = requireTaskService(config, "runner");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "exec");

      const execResult = await execute({
        sessionId: jobId,
        program: args.program,
        language: args.language,
        dependencies: args.dependencies,
        cwd: config.cwd,
      });

      const depInfo =
        args.dependencies?.length
          ? `Dependencies: ${args.dependencies.join(", ")}`
          : "";

      const prompt = execResult.background
        ? [
            `The following ${args.language} program has been executed.`,
            "",
            "任务已转入后台。",
            "",
            "Program:",
            args.program,
            depInfo && `\n${depInfo}`,
            "",
            `What to summarize: ${args.what_to_summarize}`,
            "",
            `Initial output (first 5 seconds):`,
            execResult.output,
            "",
            "You can use runner_wait to check for new output from the running process " +
            "by passing the jobId. Make sure to keep waiting until the task completes.",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `The following ${args.language} program has been executed.`,
            "",
            "Task completed.",
            "",
            "Program:",
            args.program,
            depInfo && `\n${depInfo}`,
            "",
            `What to summarize: ${args.what_to_summarize}`,
            "",
            "Execution output:",
            execResult.output,
          ]
            .filter(Boolean)
            .join("\n");

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "exec",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt,
        title: "Runner",
      });

      if (!createResult.success) {
        cleanupJob(jobId);
        return `Failed to create runner task: ${createResult.error}`;
      }

      try {
        const result = await taskService.waitForAgentReport(createResult.data.taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
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
  });
};
