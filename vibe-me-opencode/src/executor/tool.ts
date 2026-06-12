import { randomUUID } from 'node:crypto';
import type { PluginInput, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import {
  buildExecutorSummaryPrompt,
  EXECUTOR_LANGUAGES,
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  type ExecuteOptions,
  type ExecuteResult,
  type ExecutorLanguage,
  type ExecutorTimeoutType,
  execute,
  shouldSummarize,
} from 'engine/executor';
import { TOOL_COPY } from 'engine/tool-copy';
import { isAbortError } from '../utils/abort-signal';
import { resolveSubsessionParentID } from '../utils/child-agent';
import { extractToolContext } from '../utils/tool-context';
import { awaitSummarizerReport, createSummarizerSession } from './summarizer';

interface ExecutorArgs {
  language: ExecutorLanguage;
  program: string;
  dependencies?: string[];
  timeout_type: ExecutorTimeoutType;
}

export interface CreateExecutorToolDeps {
  execute: (
    options: ExecuteOptions,
    sessionId: string,
  ) => Promise<ExecuteResult>;
  createSummarizerSession: (
    client: PluginInput['client'],
    sessionID: string | undefined,
    directory: string,
  ) => Promise<{ childID: string; parentID: string | undefined }>;
  awaitSummarizerReport: (
    client: PluginInput['client'],
    childID: string,
    prompt: string,
    directory: string,
    abortSignal: AbortSignal | undefined,
  ) => Promise<string>;
  extractToolContext: (
    context: unknown,
    fallbackDirectory: string,
  ) => {
    directory: string;
    sessionID: string | undefined;
    abortSignal: AbortSignal | undefined;
  };
  resolveSubsessionParentID: (sessionID?: string) => string | undefined;
  isAbortError: (err: unknown) => boolean;
}

const defaultDeps: CreateExecutorToolDeps = {
  execute,
  createSummarizerSession,
  awaitSummarizerReport,
  extractToolContext,
  resolveSubsessionParentID,
  isAbortError,
};

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

export function createExecutorTool(
  ctx: PluginInput,
  deps: CreateExecutorToolDeps = defaultDeps,
): ToolDefinition {
  const client = ctx.client;

  return tool({
    description: TOOL_COPY.executor.description,
    args: executorToolArgs,
    async execute(args, context) {
      const language: ExecutorLanguage = EXECUTOR_LANGUAGES.includes(
        args.language,
      )
        ? args.language
        : 'shell';
      const validatedArgs = { ...args, language };

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

async function runExecution(
  deps: CreateExecutorToolDeps,
  args: ExecutorArgs,
  directory: string,
  sessionId: string,
): Promise<ExecuteResult> {
  return deps.execute(toExecuteOptions(args, directory), sessionId);
}

function toExecuteOptions(
  args: ExecutorArgs,
  directory: string,
): ExecuteOptions {
  return {
    program: args.program,
    language: args.language,
    dependencies: args.dependencies,
    timeoutType: args.timeout_type,
    cwd: directory,
  };
}

async function summarizeIfNeeded(
  deps: CreateExecutorToolDeps,
  client: PluginInput['client'],
  args: ExecutorArgs,
  execResult: ExecuteResult,
  ctx: {
    sessionID: string | undefined;
    directory: string;
    abortSignal: AbortSignal | undefined;
  },
): Promise<string> {
  if (!shouldSummarize(execResult.output)) {
    return execResult.output;
  }

  const { childID } = await deps.createSummarizerSession(
    client,
    ctx.sessionID,
    ctx.directory,
  );

  try {
    const prompt = buildSummaryPrompt(args, execResult);
    return await deps.awaitSummarizerReport(
      client,
      childID,
      prompt,
      ctx.directory,
      ctx.abortSignal,
    );
  } finally {
    await abortSessionQuietly(client, childID);
  }
}

function buildSummaryPrompt(
  args: ExecutorArgs,
  execResult: ExecuteResult,
): string {
  return `${EXECUTOR_SUMMARIZER_SYSTEM_PROMPT}\n\n${buildExecutorSummaryPrompt(
    {
      program: args.program,
      language: args.language,
      dependencies: args.dependencies,
      timeoutType: args.timeout_type,
    },
    execResult,
  )}`;
}

async function abortSessionQuietly(
  client: PluginInput['client'],
  childID: string,
): Promise<void> {
  try {
    await client.session.abort({ path: { id: childID } });
  } catch {}
}

function handleExecutionError(
  err: unknown,
  isAbortError: (err: unknown) => boolean,
): string {
  if (isAbortError(err)) {
    return '(aborted)';
  }
  throw err;
}
