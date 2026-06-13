import type { PluginInput } from '@opencode-ai/plugin';
import type { ExecuteResult } from 'engine/executor';
import { shouldSummarize } from 'engine/executor';
import { buildSummaryPrompt } from './options.js';
import type { CreateExecutorToolDeps, ExecutorArgs } from './types.js';

async function abortSessionQuietly(
  client: PluginInput['client'],
  childID: string,
): Promise<void> {
  try {
    await client.session.abort({ path: { id: childID } });
  } catch {}
}

export async function summarizeIfNeeded(
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
