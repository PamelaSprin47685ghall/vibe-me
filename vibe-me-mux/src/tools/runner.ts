import { randomUUID } from "node:crypto";
import type { JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import { requireWorkspaceId } from "../types/contract.js";
import { isForegroundWaitBackgroundedError } from "./submitReview.js";
import type { HostDependencies } from "../types/deps.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";
import { AGENT_POLICIES } from "engine";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: ["shell", "python", "javascript"],
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

export interface RunnerToolDeps {
  execute: typeof import("engine/runner").execute;
  cleanupJob: (jobId: string) => void;
  globalJobRegistry: Map<string, { taskId?: string }>;
  extendedShellReadCommands: ReadonlySet<string>;
}

export function createRunnerTool(deps: HostDependencies, runnerDeps: RunnerToolDeps): ToolDefinition {
  const resolveDelegatedAgentAiSettings = createResolveDelegatedAgentAiSettings(deps);

  return {
    name: "runner",
    description:
      "Execute a shell command or Python program and delegate output summarization to a sub-agent. " +
      "Supports quick synchronous execution and long-running background tasks. " +
      "Automatically handles timeout management and provides incremental output monitoring.",
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as { language: "shell" | "python" | "javascript"; program: string; dependencies?: string[]; what_to_summarize: string };
      const workspaceId = requireWorkspaceId(config, "runner");
      const jobId = `${workspaceId}/${randomUUID()}`;
      const taskService = config.taskService;
      if (!taskService) throw new Error("runner requires taskService");
      const execResult = await runnerDeps.execute({
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

      const aiSettings = await resolveDelegatedAgentAiSettings(config, "explore");
      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        ...(aiSettings?.modelString != null && { modelString: aiSettings.modelString }),
        ...(aiSettings?.thinkingLevel != null && { thinkingLevel: aiSettings.thinkingLevel }),
        prompt,
        title: "Runner",
        experiments: {
          subagentRole: "runner",
          toolPolicy: {
             disabledTools: [...AGENT_POLICIES.runner.disabledTools],
          },
        },
      });

      if (!createResult.success) {
        runnerDeps.cleanupJob(jobId);
        return `Failed to create runner task: ${createResult.error}`;
      }

      const job = runnerDeps.globalJobRegistry.get(jobId);
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
        const report = result.reportMarkdown;
        const effectiveLanguage = a.language ?? "shell";
        if (effectiveLanguage !== "shell") return report;
        const firstWord = a.program.trim().split(/\s+/)[0]?.split("/")?.pop();
        if (!firstWord || !runnerDeps.extendedShellReadCommands.has(firstWord)) return report;
        return `// 绝对禁止使用 runner 工具仅仅用于查找或者读写文件，请使用专门工具例如 read/greper/editor 代替！\n${report}`;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Runner task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        runnerDeps.cleanupJob(jobId);
        const partial = execResult.background
          ? "\n\nPartial output before abort:\n" + execResult.output
          : "";
        return `Runner task was aborted.${partial}`;
      }
    },
  };
}
