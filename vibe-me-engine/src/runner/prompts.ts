import { EXTENDED_SHELL_READ_COMMANDS } from './read-commands.js';

export const RUNNER_READ_ONLY_WARNING = '// 绝对禁止使用 runner 工具仅仅用于查找或者读写文件，请使用专门工具例如 read/greper/editor 代替！';

export const RUNNER_SYSTEM_PROMPT = `You are a command output summarizer.
The command has already been started by the system.
You only have runner_wait and runner_abort.
Summarize output concisely, mention errors explicitly, and do not invent details.`;

export function buildRunnerPrompt(
  language: string,
  program: string,
  dependencies: string[] | undefined,
  whatToSummarize: string,
  output: string,
  background: boolean,
  message?: string,
): string {
  const depInfo = dependencies?.length ? `Dependencies: ${dependencies.join(', ')}\n\n` : '';
  const headline = background
    ? `The following ${language} program is running in background.`
    : `The following ${language} program has been executed.`;
  const nextStep = background
    ? 'Use runner_wait to poll for more output or runner_abort to stop the task.'
    : 'Task completed.';
  return [
    headline,
    '',
    nextStep,
    '',
    'Program:',
    program,
    '',
    depInfo.trimEnd(),
    depInfo ? '' : null,
    'What to summarize:',
    whatToSummarize,
    '',
    background ? 'Initial output:' : 'Execution output:',
    output,
    message ?? null,
  ].filter(Boolean).join('\n');
}

export function formatRunnerSafetyWarning(output: string, program: string, language: string): string {
  if (language !== 'shell') return output;
  const firstWord = program.trim().split(/\s+/)[0]?.split('/').pop();
  if (!firstWord || !EXTENDED_SHELL_READ_COMMANDS.has(firstWord)) return output;
  return `${RUNNER_READ_ONLY_WARNING}\n${output}`;
}
