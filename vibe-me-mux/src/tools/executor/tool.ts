import { TOOL_COPY } from 'engine/tool-copy';
import { shouldSummarize } from 'engine/executor';
import type { JsonSchema, ToolDefinition } from '../../types/contract.js';
import { requireWorkspaceId } from '../../types/contract.js';
import type { HostDependencies } from '../../types/deps.js';
import { createResolveDelegatedAgentAiSettings } from '../resolveDelegatedAgentAiSettings.js';
import { parameters } from './parameters.js';
import { buildExecutorOptions, buildSessionId } from './options.js';
import { summarizeOutput } from './summarize.js';
import { validateExecutorArgs } from './validate.js';
import type { ExecutorToolDeps } from './types.js';

export function createExecutorTool(deps: HostDependencies, executorDeps: ExecutorToolDeps): ToolDefinition {
  const resolveAiSettings = executorDeps.resolveAiSettings ?? createResolveDelegatedAgentAiSettings(deps);

  return {
    name: 'executor',
    description: TOOL_COPY.executor.description,
    parameters: parameters as JsonSchema,
    execute: async (config, args) => {
      const validated = validateExecutorArgs(args);
      if (validated._tag === 'Err') throw new Error(validated.error);
      const workspaceId = requireWorkspaceId(config, 'executor');

      const execResult = await executorDeps.execute(
        buildExecutorOptions(validated.value, config.cwd),
        buildSessionId(workspaceId),
      );
      if (!shouldSummarize(execResult.output)) return execResult.output;
      return summarizeOutput(validated.value, execResult, config, workspaceId, resolveAiSettings);
    },
  };
}
