import { randomUUID } from 'node:crypto';
import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import {
  buildExecutorSummaryPrompt,
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  execute,
  shouldSummarize,
} from 'engine/executor';
import { TOOL_COPY } from 'engine/tool-copy';
import { isAbortError } from '../utils/abort-signal';
import { resolveSubsessionParentID } from '../utils/child-agent';
import { extractToolContext } from '../utils/tool-context';
import { awaitSummarizerReport, createSummarizerSession } from './summarizer';

export function createExecutorTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.executor.description,

    args: {
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
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );
      const parentID = resolveSubsessionParentID(sessionID) ?? sessionID;
      const sessionId = `${parentID ?? 'orphan'}/${randomUUID()}`;
      try {
        const execResult = await execute(
          {
            program: args.program,
            language: args.language,
            dependencies: args.dependencies,
            timeoutType: args.timeout_type,
            cwd: directory,
          },
          sessionId,
        );

        if (!shouldSummarize(execResult.output)) {
          return execResult.output;
        }

        const { childID } = await createSummarizerSession(
          client,
          sessionID,
          directory,
        );
        const prompt = `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}\n\n${buildExecutorSummaryPrompt(
          {
            program: args.program,
            language: args.language,
            dependencies: args.dependencies,
            timeoutType: args.timeout_type,
          },
          execResult,
        )}`;

        try {
          return await awaitSummarizerReport(
            client,
            childID,
            prompt,
            directory,
            abortSignal,
          );
        } finally {
          try {
            client.session.abort({ path: { id: childID } });
          } catch {}
        }
      } catch (err) {
        if (isAbortError(err)) return '(aborted)';
        throw err;
      }
    },
  });
}
