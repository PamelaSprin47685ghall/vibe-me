import type { PluginInput } from '@opencode-ai/plugin';
import {
  buildRunnerPrompt,
  type ExecuteResult,
  execute as executeCommand,
} from 'engine/runner';
import { EXTENDED_SHELL_READ_COMMANDS } from 'engine/runner/read-commands';
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
    language?: string;
    dependencies?: string[];
  },
  childID: string,
  sessionID: string | undefined,
  directory: string,
): Promise<ExecuteResult> {
  const language = (args.language ?? 'shell') as 'shell' | 'python' | 'javascript';
  return executeCommand({
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
    language?: string;
    dependencies?: string[];
    what_to_summarize: string;
  },
  execResult: ExecuteResult,
): string {
  const language = args.language ?? 'shell';
  return buildRunnerPrompt(
    language,
    args.program,
    args.dependencies,
    args.what_to_summarize,
    execResult.output,
    execResult.background,
    execResult.message,
  );
}

export async function extractRunnerSummary(
  client: PluginInput['client'],
  args: { program: string; language?: string },
  childID: string,
  directory: string,
): Promise<string> {
  const summary = await extractSessionText(client, childID, directory);
  const language = args.language ?? 'shell';
  if (language === 'shell') {
    const firstWord = args.program.trim().split(/\s+/)[0];
    if (firstWord && EXTENDED_SHELL_READ_COMMANDS.has(firstWord)) {
      return `// 绝对禁止使用 runner 工具仅仅用于查找或者读写文件，请使用专门工具例如 read/greper/editor 代替！\n${summary || '(no output)'}`;
    }
  }
  return summary || '(no output)';
}