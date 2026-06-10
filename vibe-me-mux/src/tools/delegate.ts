import type { PluginToolConfiguration } from "../types/tool.js";
import type { HostDependencies } from "../types/deps.js";
import { requireWorkspaceId } from "../types/contract.js";
import { isForegroundWaitBackgroundedError } from "./submitReview.js";
import { createResolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings.js";

export interface DelegateOptions {
  readonly aiSettingsAgentId?: string;
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
  const workspaceId = requireWorkspaceId(config, title.toLowerCase());
  const taskService = config.taskService;
  if (!taskService) throw new Error(`No task service for ${title.toLowerCase()}`);
  const aiSettings = options?.aiSettingsAgentId
    ? await createResolveDelegatedAgentAiSettings(deps)(
        config,
        options.aiSettingsAgentId,
      )
    : undefined;

  const createResult = await taskService.create({
    parentWorkspaceId: workspaceId,
    kind: "agent",
    agentId,
    ...(aiSettings?.modelString != null && { modelString: aiSettings.modelString }),
    ...(aiSettings?.thinkingLevel != null && { thinkingLevel: aiSettings.thinkingLevel }),
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
        backgroundOnMessageQueued: false,
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
