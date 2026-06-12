import type { PluginInput } from '@opencode-ai/plugin';
import {
  buildRunnerPrompt,
  type ExecuteResult,
  execute as executeCommand,
  formatRunnerSafetyWarning,
  type JobRegistry,
} from 'engine/runner';

import {
  registerChildAgent,
  resolveSubsessionParentID,
} from '../utils/child-agent';
import { extractSessionText } from '../utils/session-messages';

export const managedRunnerSessions = new Set<string>();

export async function createChildSession(
  client: PluginInput['client'],
  sessionID: string | undefined,
  directory: string,
): Promise<{ childID: string; parentID: string | undefined }> {
  const parentID = resolveSubsessionParentID(sessionID);
  const result = await client.session.create({
    query: { directory },
    body: { parentID, title: 'Runner' },
  });
  const childID = result.data?.id;
  if (!childID) throw new Error('Failed to create child session');
  registerChildAgent(childID, 'runner', parentID);
  return { childID, parentID };
}

export async function executeRunnerCommand(
  args: {
    program: string;
    language: 'shell' | 'python' | 'javascript';
    dependencies?: string[];
  },
  childID: string,
  sessionID: string | undefined,
  directory: string,
  jobs: JobRegistry,
): Promise<ExecuteResult> {
  const language = args.language;
  return executeCommand({
    jobs,
    sessionId: childID,
    parentSessionId: sessionID,
    program: args.program,
    language,
    dependencies: args.dependencies,
    cwd: directory,
  });
}

export function buildRunnerPromptText(
  args: {
    program: string;
    language: 'shell' | 'python' | 'javascript';
    dependencies?: string[];
    what_to_summarize: string;
  },
  execResult: ExecuteResult,
): string {
  const language = args.language;
  return buildRunnerPrompt(
    language,
    args.program,
    args.dependencies,
    args.what_to_summarize,
    execResult.output,
    execResult._tag,
    execResult._tag === 'Backgrounded' ? execResult.jobId : undefined,
  );
}

export async function extractRunnerSummary(
  client: PluginInput['client'],
  args: { program: string; language: 'shell' | 'python' | 'javascript' },
  childID: string,
  directory: string,
): Promise<string> {
  const summary = await extractSessionText(client, childID, directory);
  return formatRunnerSafetyWarning(summary || '(no output)', args.program, args.language);
}
