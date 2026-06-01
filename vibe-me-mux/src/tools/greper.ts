import { tool } from "ai";
import { z } from "zod";
import type { ToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

const GreperToolInputSchema = z.object({
  intent: z.string().describe("Natural-language description of the code to search for"),
});

export const createGreperTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description:
      "Receive a natural-language intent for code search and delegate to the search agent. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    inputSchema: GreperToolInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "greper");
      const taskService = requireTaskService(config, "greper");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "explore");

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt: args.intent,
        title: "Greper",
      });

      if (!createResult.success) {
        return `Failed to create greper task: ${createResult.error}`;
      }

      try {
        const result = await taskService.waitForAgentReport(createResult.data.taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Greper task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        throw error;
      }
    },
  });
};
