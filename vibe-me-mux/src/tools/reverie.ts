import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { PluginToolConfiguration, ToolFactory } from "../types/tool";
import {
  isForegroundWaitBackgroundedError,
  requireTaskService,
  requireWorkspaceId,
} from "../types/tool";
import { resolveDelegatedAgentAiSettings } from "./resolveDelegatedAgentAiSettings";

const ReverieToolInputSchema = z.object({
  intent: z.string().describe("A natural-language intent or question to contemplate..."),
  files: z.array(z.string()).describe("File paths to provide as context..."),
});

export const createReverieTool: ToolFactory = (config: PluginToolConfiguration) => {
  return tool({
    description:
      "Receive a natural-language intent or question for deep reasoning and delegate to the reverie agent. IMPORTANT: Do NOT assume the reverie agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent and files. Failure to do so will cause severe confusion.",
    inputSchema: ReverieToolInputSchema,
    execute: async (args, { abortSignal }) => {
      const workspaceId = requireWorkspaceId(config, "reverie");
      const taskService = requireTaskService(config, "reverie");
      const aiSettings = await resolveDelegatedAgentAiSettings(config, "explore");

      const fileSections = await Promise.all(
        args.files.map(async (file) => {
          const resolvedPath = path.resolve(config.cwd, file);
          try {
            const content = await fs.readFile(resolvedPath, "utf-8");
            return `=== ${file} ===\n\n${content}`;
          } catch {
            return `=== ${file} ===\n\n(unable to read)`;
          }
        }),
      );

      const prompt = `${fileSections.join("\n")}\nQuestion:\n${args.intent}`;

      const createResult = await taskService.create({
        parentWorkspaceId: workspaceId,
        kind: "agent",
        agentId: "explore",
        modelString: aiSettings.modelString,
        thinkingLevel: aiSettings.thinkingLevel,
        prompt,
        title: "Reverie",
      });

      if (!createResult.success) {
        return `Failed to create reverie task: ${createResult.error}`;
      }

      try {
        const result = await taskService.waitForAgentReport(createResult.data.taskId, {
          requestingWorkspaceId: workspaceId,
          abortSignal,
        });
        return result.reportMarkdown;
      } catch (error) {
        if (isForegroundWaitBackgroundedError(error)) {
          return `Reverie task (${createResult.data.taskId}) moved to background. Use task tools to monitor it.`;
        }
        throw error;
      }
    },
  });
};
