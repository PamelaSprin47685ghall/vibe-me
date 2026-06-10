import { createCapsInjector } from "./context/capsInjector.js";
import { createEventHook } from "./eventHook.js";
import { cleanupRegistry, globalJobRegistry, hasActiveJob, buildRunnerNudgePrompt } from "engine/runner";
import { deactivateReview, isReviewActive } from "engine/review";
import { globalIteratorStore } from "engine/util";
import { defaultCoordinator, TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT } from "engine/todo";
import { createSyntaxCheckWrappers } from "./wrappers/syntaxCheck.js";
import { createTodoWriteNudgeWrapper } from "./wrappers/todoWriteNudge.js";
import { createLoopCommand } from "./commands/loop.js";
import { buildAgentToolPolicies, type MuxAgentToolPolicies } from "./agent-tool-policy.js";
import { createToolCatalog, type ExecuteHostFileRead } from "./toolRegistration.js";
import { getMcpServers } from "./mcpServers.js";
import type { ToolDefinition, ToolWrapper, ToolLike, PluginToolArgs } from "./types/contract.js";
import type { HostDependencies } from "./types/deps.js";
import type { ContextInjectorRegistration, PluginEventHook, PluginSlashCommandDefinition } from "./types/tool.js";

export interface PluginRegistration {
  readonly toolNames: readonly string[];
  readonly tools: readonly ToolDefinition[];
  readonly wrappers: readonly ToolWrapper[];
  readonly mcpServers: Readonly<Record<string, string>>;
  readonly contextInjector: ContextInjectorRegistration;
  readonly eventHook: PluginEventHook;
  readonly slashCommands: readonly PluginSlashCommandDefinition[];
  readonly agentToolPolicies: MuxAgentToolPolicies;
}

function createWebOverrideWrapper(
  def: ToolDefinition,
  targetTool: string,
): ToolWrapper {
  return {
    targetTool,
    wrapper: (_tool, config) => ({
      description: def.description,
      parameters: def.parameters,
      execute: (args: PluginToolArgs, options?: { readonly abortSignal?: AbortSignal }) =>
        def.execute(
          { ...config, abortSignal: options?.abortSignal },
          args,
        ),
    }) as ToolLike,
  };
}

export function createRegistration(
  deps: HostDependencies,
): PluginRegistration {
  let hostFileReadExecute: ExecuteHostFileRead | undefined;

  const executeHostFileRead = (
    args: unknown,
    opts?: { readonly abortSignal?: AbortSignal },
  ): Promise<unknown> => {
    if (hostFileReadExecute === undefined) {
      throw new Error("Host file_read wrapper has not been initialized");
    }

    return hostFileReadExecute(args, opts);
  };

  const catalog = createToolCatalog(deps, executeHostFileRead);
  const tools = Object.values(catalog);

  return {
    toolNames: tools.map((t) => t.name),
    tools,
    mcpServers: getMcpServers(),
    wrappers: [
      ...createSyntaxCheckWrappers(deps.log),
      createWebOverrideWrapper(catalog.websearch, "web_search"),
      createWebOverrideWrapper(catalog.webfetch, "web_fetch"),
      {
        targetTool: "file_read",
        wrapper: (hostTool) => {
          hostFileReadExecute = (hostTool as { execute: (...a: readonly unknown[]) => Promise<unknown> }).execute.bind(hostTool);
          return { execute: async () => "disabled" } as ToolLike;
        },
      },
      createTodoWriteNudgeWrapper(),
    ],
    contextInjector: createCapsInjector(),
    eventHook: createEventHook({
      cleanupRegistry,
      globalJobRegistry,
      deactivateReview,
      isReviewActive,
      clearIteratorScope: globalIteratorStore.clearScope.bind(globalIteratorStore),
      coordinator: defaultCoordinator,
      hasActiveJob,
      buildRunnerNudgePrompt,
      TODO_NUDGE_PROMPT,
      LOOP_NUDGE_PROMPT,
    }),
    slashCommands: createLoopCommand(deps),
    agentToolPolicies: buildAgentToolPolicies(),
  };
}
