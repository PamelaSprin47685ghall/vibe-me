import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import {
  requireWorkspaceId,
  requireTaskService,
  isForegroundWaitBackgroundedError,
} from "../types/contract.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";

export interface DelegateOptions {
  readonly experiments?: { readonly subagentRole?: string; readonly toolPolicy?: { readonly disabledTools?: readonly string[] } };
}

export async function delegateToSubAgent(
  config: PluginToolConfiguration,
  deps: HostDependencies,
  agentId: string,
  prompt: string,
  title: string,
  options?: DelegateOptions,
): Promise<string> {
  const resolveDelegatedAgentAiSettings =
    createResolveDelegatedAgentAiSettings(deps);
  const workspaceId = requireWorkspaceId(config, title.toLowerCase());
  const taskService = requireTaskService(config, title.toLowerCase());
  const aiSettings = await resolveDelegatedAgentAiSettings(config, agentId);

  const createResult = await taskService.create({
    parentWorkspaceId: workspaceId,
    kind: "agent",
    agentId,
    modelString: aiSettings.modelString,
    thinkingLevel: aiSettings.thinkingLevel,
    prompt,
    title,
    experiments: options?.experiments,
  });

  if (!createResult.success) {
    return `Failed to create ${title.toLowerCase()} task: ${createResult.error}`;
  }

  try {
    const result = await taskService.waitForAgentReport(
      createResult.data.taskId,
      {
        requestingWorkspaceId: workspaceId,
        abortSignal: config.abortSignal,
      },
    );
    return result.reportMarkdown;
  } catch (error) {
    if (isForegroundWaitBackgroundedError(error)) {
      return `${title} task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
    }
    throw error;
  }
}
