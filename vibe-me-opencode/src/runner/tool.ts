import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { cleanupJob, type JobRegistry } from 'engine/runner';
import { TOOL_COPY } from 'engine/tool-copy';
import { isAbortError, promptWithAbort } from '../utils/abort-signal';
import { extractSessionText } from '../utils/session-messages';
import { extractToolContext } from '../utils/tool-context';
import { unregisterChildAgent } from '../utils/child-agent';
import {
  buildRunnerPromptText,
  createChildSession,
  executeRunnerCommand,
  extractRunnerSummary,
} from './execute';
import { runNudgeLoop } from './nudge-loop';

export function createRunnerTool(ctx: PluginInput, jobs: JobRegistry): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.runner.description,

    args: {
      language: tool.schema
        .enum(['shell', 'python', 'javascript'])
        .default('shell')
        .describe(TOOL_COPY.runner.params.language),
      program: tool.schema
        .string()
        .describe(TOOL_COPY.runner.params.program),
      dependencies: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe(TOOL_COPY.runner.params.dependencies),
      what_to_summarize: tool.schema
        .string()
        .describe(TOOL_COPY.runner.params.what_to_summarize),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );

      const { childID } = await createChildSession(client, sessionID, directory);

      try {
        const execResult = await executeRunnerCommand(args, childID, sessionID, directory, jobs);
        const promptText = buildRunnerPromptText(args, execResult);

        await promptWithAbort(
          client,
          {
            path: { id: childID },
            body: { agent: 'runner', parts: [{ type: 'text', text: promptText }] },
          },
          abortSignal,
        );

        if (execResult._tag === 'Backgrounded') {
          const nudgeResult = await runNudgeLoop(client, childID, abortSignal, jobs);
          if (nudgeResult) return nudgeResult;
        }

        return await extractRunnerSummary(client, args, childID, directory);
      } catch (err) {
        if (isAbortError(err)) {
          try { client.session.abort({ path: { id: childID } }); } catch (_) {}
          cleanupJob(jobs, childID);
          unregisterChildAgent(childID);
          const text = await extractSessionText(client, childID, directory);
          return text ? `(aborted) ${text}` : '(aborted)';
        }
        cleanupJob(jobs, childID);
        unregisterChildAgent(childID);
        throw err;
      }
    },
  });
}
