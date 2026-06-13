import type { ExecuteResult } from 'engine/executor';
import type { PluginToolConfiguration } from '../../types/tool.js';
import type { TaskCreateResult, TaskServiceLike } from '../../types/deps.js';
import { isForegroundWaitBackgroundedError } from '../submitReview.js';
import type { ResolvedDelegatedAgentAiSettings } from '../resolveDelegatedAgentAiSettings.js';
import { buildSummaryPrompt } from './options.js';
import { SUMMARIZER_DISABLED_TOOLS } from './parameters.js';
import type { ValidatedExecutorArgs } from './types.js';

async function createSummaryTask(
  taskService: TaskServiceLike,
  workspaceId: string,
  args: ValidatedExecutorArgs,
  execResult: ExecuteResult,
  aiSettings: ResolvedDelegatedAgentAiSettings,
): Promise<TaskCreateResult> {
  return taskService.create({
    parentWorkspaceId: workspaceId,
    kind: 'agent',
    agentId: 'explore',
    ...(aiSettings.modelString != null && { modelString: aiSettings.modelString }),
    ...(aiSettings.thinkingLevel != null && { thinkingLevel: aiSettings.thinkingLevel }),
    prompt: buildSummaryPrompt(args, execResult),
    title: 'Executor summary',
    experiments: {
      subagentRole: 'summarizer',
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
      return `Executor summarizer task (${taskId}) moved to background. Raw output retained below.

${rawOutput}`;
    }
    throw error;
  }
}

export async function summarizeOutput(
  args: ValidatedExecutorArgs,
  execResult: ExecuteResult,
  config: PluginToolConfiguration,
  workspaceId: string,
  resolveAiSettings: NonNullable<import('./types.js').ExecutorToolDeps['resolveAiSettings']>,
): Promise<string> {
  if (!config.taskService) {
    return `[executor] Output exceeded ${execResult.output.length} bytes but no taskService is available to summarize. Raw output:

${execResult.output}`;
  }
  const aiSettings = await resolveAiSettings(config, 'explore');
  const createResult = await createSummaryTask(config.taskService, workspaceId, args, execResult, aiSettings);
  if (!createResult.success) {
    return `[executor] Failed to create summarizer task: ${createResult.error}

Raw output:
${execResult.output}`;
  }
  return waitForSummaryReport(
    config.taskService,
    createResult.data.taskId,
    workspaceId,
    execResult.output,
    config.abortSignal,
  );
}
