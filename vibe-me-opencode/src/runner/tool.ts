import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import { cleanupJob } from 'engine/runner';
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

export function createRunnerTool(ctx: PluginInput): ToolDefinition {
  const client = ctx.client;

  return tool({
    description:
      'Executes a shell command, Python code, or JavaScript/TypeScript program and returns a natural-language summary. ' +
      'Supports both quick synchronous execution and long-running background tasks. ' +
      'Automatically handles timeout management and provides incremental output monitoring. ' +
      'IMPORTANT: If executing Python (language="python") or JavaScript (language="javascript") code, you must specify all necessary third-party package dependencies (e.g. numpy, pandas, requests for Python; lodash, axios for JavaScript) in the "dependencies" argument so they can be installed and resolved before execution.',

    args: {
      language: tool.schema
        .enum(['shell', 'python', 'javascript'])
        .default('shell')
        .describe('Execution language: shell, python, or javascript'),
      program: tool.schema
        .string()
        .describe(
          'The program to execute. Can be a shell command, Python code, or JavaScript/TypeScript code depending on language',
        ),
      dependencies: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe(
          'Dependencies to install (for python or javascript language). For Python or JavaScript programs, explicitly specify all third-party libraries used in the code so they can be available.',
        ),
      what_to_summarize: tool.schema
        .string()
        .describe('What to look for in the output. Be specific.'),
    },

    async execute(args, context) {
      const { directory, sessionID, abortSignal } = extractToolContext(
        context,
        ctx.directory,
      );

      const { childID } = await createChildSession(client, sessionID, directory);

      try {
        const execResult = await executeRunnerCommand(args, childID, sessionID, directory);
        const promptText = buildRunnerPromptText(args, execResult);

        await promptWithAbort(
          client,
          {
            path: { id: childID },
            body: { agent: 'runner', parts: [{ type: 'text', text: promptText }] },
          },
          abortSignal,
        );

        if (execResult.background) {
          const nudgeResult = await runNudgeLoop(client, childID, abortSignal);
          if (nudgeResult) return nudgeResult;
        }

        return await extractRunnerSummary(client, args, childID, directory);
      } catch (err) {
        if (isAbortError(err)) {
          try { client.session.abort({ path: { id: childID } }); } catch (_) {}
          cleanupJob(childID);
          unregisterChildAgent(childID);
          const text = await extractSessionText(client, childID, directory);
          return text ? `(aborted) ${text}` : '(aborted)';
        }
        cleanupJob(childID);
        unregisterChildAgent(childID);
        throw err;
      }
    },
  });
}