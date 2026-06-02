import { tool } from "ai";
import { z } from "zod";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

const BrowserToolInputSchema = z.object({
  intent: z.string().describe("Natural-language description of the web task to perform"),
});

export const createBrowserTool: ToolFactory = (config: PluginToolConfiguration) => {
  return tool({
    description:
      "Receive a natural-language intent for a web task and delegate to the browser agent. IMPORTANT: Do NOT assume the browser agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    inputSchema: BrowserToolInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "browser");
      const taskService = requireTaskService(config, "browser");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "desktop");

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "desktop",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt: args.intent,
        title: "Browser",
      });

      if (!createResult.success) {
        return `Failed to create browser task: ${createResult.error}`;
      }

      try {
        const result = await taskService.waitForAgentReport(createResult.data.taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Browser task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        throw error;
      }
    },
  });
};
