import { TOOL_COPY } from "engine/tool-copy";
import { randomUUID } from "node:crypto";
import type { JsonSchema, PluginToolArgs, ToolDefinition } from "../types/contract.js";
import { requireWorkspaceId } from "../types/contract.js";
import { isForegroundWaitBackgroundedError } from "./submitReview.js";
import type { HostDependencies } from "../types/deps.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";
import { deniedToolsFor } from "./policy.js";
import { formatRunnerSafetyWarning, type JobEntry } from "engine/runner";
import { buildMuxRunnerPrompt } from "./runner-prompt.js";

const parameters: JsonSchema = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: ["shell", "python", "javascript"],
      description: TOOL_COPY.runner.params.language,
    },
    program: {
      type: "string",
      description: TOOL_COPY.runner.params.program,
    },
    dependencies: {
      type: "array",
      items: {
        type: "string",
        description: "Python dependency package name",
      },
      description: TOOL_COPY.runner.params.dependencies,
    },
    what_to_summarize: {
      type: "string",
      description: TOOL_COPY.runner.params.what_to_summarize,
    },
  },
  required: ["language", "program", "what_to_summarize"],
  additionalProperties: false,
};

export interface RunnerToolDeps {
  execute: typeof import("engine/runner").execute;
  cleanupJob: (jobId: string) => void;
  globalJobRegistry: Map<string, JobEntry>;
}

export function createRunnerTool(deps: HostDependencies, runnerDeps: RunnerToolDeps): ToolDefinition {
  const resolveDelegatedAgentAiSettings = createResolveDelegatedAgentAiSettings(deps);

  return {
    name: "runner",
    description: TOOL_COPY.runner.description,
    parameters,
    execute: async (config, args: PluginToolArgs) => {
      const a = args as { language: "shell" | "python" | "javascript"; program: string; dependencies?: string[]; what_to_summarize: string };
      const workspaceId = requireWorkspaceId(config, "runner");
      const jobId = `${workspaceId}/${randomUUID()}`;
      const taskService = config.taskService;
      if (!taskService) throw new Error("runner requires taskService");
      const execResult = await runnerDeps.execute({
        jobs: runnerDeps.globalJobRegistry,
        sessionId: jobId,
        parentSessionId: workspaceId,
        program: a.program,
        language: a.language ?? "shell",
        dependencies: a.dependencies,
        cwd: config.cwd,
      });

      const prompt = buildMuxRunnerPrompt(
        { language: a.language ?? "shell", program: a.program, dependencies: a.dependencies, whatToSummarize: a.what_to_summarize },
        execResult,
      );

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
             disabledTools: deniedToolsFor("runner"),
          },
        },
      });

      if (!createResult.success) {
        runnerDeps.cleanupJob(jobId);
        return `Failed to create runner task: ${createResult.error}`;
      }

      const job = runnerDeps.globalJobRegistry.get(jobId);
      if (job) job.record = { ...job.record, taskId: createResult.data.taskId };

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
        return formatRunnerSafetyWarning(report, a.program, a.language ?? "shell");
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Runner task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        runnerDeps.cleanupJob(jobId);
        const partial = execResult._tag === 'Backgrounded'
          ? "\n\nPartial output before abort:\n" + execResult.output
          : "";
        return `Runner task was aborted.${partial}`;
      }
    },
  };
}
