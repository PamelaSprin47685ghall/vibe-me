import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import {
  abort,
  buildRunnerNudgePrompt,
  buildRunnerPrompt,
  cleanupJob,
  type ExecuteResult,
  execute as executeCommand,
  getActiveJobs,
  hasActiveJob,
  RUNNER_SYSTEM_PROMPT,
  wait,
} from 'engine/runner';
import {
  registerChildAgent,
  resolveSubsessionParentID,
  unregisterChildAgent,
} from '../utils/child-agent';
import {
  extractSessionText,
  extractToolContext,
  isAbortError,
  promptWithAbort,
} from '../utils/session';

export { RUNNER_SYSTEM_PROMPT };

/** Sessions currently being managed by the runner tool's background nudge loop */
export const managedRunnerSessions = new Set<string>();

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

      const parentID = resolveSubsessionParentID(sessionID);

      const createResult = await client.session.create({
        query: { directory },
        body: {
          parentID,
          title: 'Runner',
        },
      });
      const childID = createResult.data?.id;
      if (!childID) return 'Failed to create child session';
      registerChildAgent(childID, 'runner', parentID);

      try {
        const language = args.language ?? 'shell';

        const execResult: ExecuteResult = await executeCommand({
          sessionId: childID,
          parentSessionId: sessionID,
          program: args.program,
          language,
          dependencies: args.dependencies,
          cwd: directory,
        });

        const prompt = buildRunnerPrompt(
          language,
          args.program,
          args.dependencies,
          args.what_to_summarize,
          execResult.output,
          execResult.background,
          execResult.message,
        );

        await promptWithAbort(
          client,
          {
            path: { id: childID },
            body: {
              agent: 'runner',
              parts: [{ type: 'text', text: prompt }],
            },
          },
          abortSignal,
        );

        if (execResult.background) {
          managedRunnerSessions.add(childID);
          try {
            let nudgeCount = 0;
            const MAX_RUNNER_NUDGES = 10;
            while (
              hasActiveJob(getActiveJobs, childID) &&
              nudgeCount < MAX_RUNNER_NUDGES
            ) {
              await promptWithAbort(
                client,
                {
                  path: { id: childID },
                  body: {
                    agent: 'runner',
                    parts: [{ type: 'text', text: buildRunnerNudgePrompt() }],
                  },
                },
                abortSignal,
              );
              nudgeCount++;
            }

            if (hasActiveJob(getActiveJobs, childID)) {
              abort(childID);
              cleanupJob(childID);
              return 'Runner did not respond after multiple attempts. The background task has been aborted.';
            }
          } finally {
            managedRunnerSessions.delete(childID);
          }
        }

        const summary = await extractSessionText(client, childID, directory);
        if (language === 'shell') {
          const firstWord = args.program.trim().split(/\s+/)[0];
          if (['head', 'tail', 'sed', 'cat', 'grep', 'rg', 'find'].includes(firstWord)) {
            return `// 绝对禁止使用 runner 工具仅仅用于查找或者读写文件，请使用专门工具例如 read/greper/editor 代替！\n${summary || '(no output)'}`;
          }
        }
        return summary || '(no output)';
      } catch (err) {
        if (isAbortError(err)) {
          try {
            client.session.abort({ path: { id: childID } });
          } catch (_) {}
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

export function createRunnerWaitTool(): ToolDefinition {
  return tool({
    description:
      'Wait for the background task to produce more output or finish.',
    args: {
      ms: tool.schema
        .number()
        .int()
        .min(100)
        .max(30000)
        .default(2000)
        .describe('Time to wait in milliseconds'),
    },
    async execute(args, context) {
      try {
        const result = await wait({
          sessionId: context.sessionID,
          ms: args.ms,
        });
        let output = result.output;
        if (result.message) {
          output = `${output}\n\n${result.message}`;
        }
        return output || '(no new output)';
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  });
}

export function createRunnerAbortTool(): ToolDefinition {
  return tool({
    description: 'Forcefully terminate the currently running background task.',
    args: {},
    async execute(_args, context) {
      try {
        return abort(context.sessionID);
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  });
}

export function getRunnerConfig() {
  return {
    agents: {
      runner: {
        prompt: RUNNER_SYSTEM_PROMPT,
        mode: 'subagent' as const,
        mcps: [],
        permission: {
          edit: 'deny',
          write: 'deny',
          glob: 'deny',
          grep: 'deny',
          fuzzy_find: 'deny',
          fuzzy_grep: 'deny',
          task: 'deny',
          read: 'deny',
          runner_wait: 'allow',
          runner_abort: 'allow',
        } as Record<string, unknown>,
      },
    },
  };
}
