import { tool } from "ai";
import { z } from "zod";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

const EditorToolInputSchema = z.object({
  intent: z.string().describe("Natural-language description of the code changes to make"),
});

export const createEditorTool: ToolFactory = (config: PluginToolConfiguration) => {
  return tool({
    description:
      "Receive a natural-language intent for code changes and delegate to the editor agent. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    inputSchema: EditorToolInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "editor");
      const taskService = requireTaskService(config, "editor");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "exec");

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "exec",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt: args.intent,
        title: "Editor",
        experiments: {
          toolPolicy: {
            disabledTools: ["bash", "task", "task_await", "task_list", "task_terminate", "task_apply_git_patch"],
          },
        },
      });

      if (!createResult.success) {
        return `Failed to create editor task: ${createResult.error}`;
      }

      try {
        const result = await taskService.waitForAgentReport(createResult.data.taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Editor task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        throw error;
      }
    },
  });
};
