import { randomUUID } from 'node:crypto';
import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import type { ExecutorLanguage } from 'engine/executor';
import { EXECUTOR_LANGUAGES, execute } from 'engine/executor';
import { TOOL_COPY } from 'engine/tool-copy';
import { isAbortError } from '../../utils/abort-signal';
import { resolveSubsessionParentID } from '../../utils/child-agent';
import { extractToolContext } from '../../utils/tool-context';
import { awaitSummarizerReport, createSummarizerSession } from '../summarizer';
import { handleExecutionError, runExecution } from './run.js';
import { summarizeIfNeeded } from './summarize.js';
import type { CreateExecutorToolDeps } from './types.js';

const executorToolArgs = {
  language: tool.schema
    .enum(['shell', 'python', 'javascript'])
    .default('shell')
    .describe(TOOL_COPY.executor.params.language),
  program: tool.schema.string().describe(TOOL_COPY.executor.params.program),
  dependencies: tool.schema
    .array(tool.schema.string())
    .optional()
    .describe(TOOL_COPY.executor.params.dependencies),
  timeout_type: tool.schema
    .enum(['short', 'long'])
    .describe(TOOL_COPY.executor.params.timeout_type),
};

const defaultDeps: CreateExecutorToolDeps = {
  execute,
  createSummarizerSession,
  awaitSummarizerReport,
  extractToolContext,
  resolveSubsessionParentID,
  isAbortError,
};

function normalizeLanguage(raw: string): ExecutorLanguage {
  return EXECUTOR_LANGUAGES.includes(raw as ExecutorLanguage)
    ? (raw as ExecutorLanguage)
    : 'shell';
}

export function createExecutorTool(
  ctx: PluginInput,
  deps: CreateExecutorToolDeps = defaultDeps,
): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.executor.description,
    args: executorToolArgs,
    async execute(args, context) {
      const validatedArgs = {
        ...args,
        language: normalizeLanguage(args.language),
      };

      const { directory, sessionID, abortSignal } = deps.extractToolContext(
        context,
        ctx.directory,
      );
      const parentID = deps.resolveSubsessionParentID(sessionID) ?? sessionID;
      const sessionId = `${parentID ?? 'orphan'}/${randomUUID()}`;

      try {
        const execResult = await runExecution(
          deps,
          validatedArgs,
          directory,
          sessionId,
        );
        return await summarizeIfNeeded(
          deps,
          client,
          validatedArgs,
          execResult,
          {
            sessionID,
            directory,
            abortSignal,
          },
        );
      } catch (err) {
        return handleExecutionError(err, deps.isAbortError);
      }
    },
  });
}
