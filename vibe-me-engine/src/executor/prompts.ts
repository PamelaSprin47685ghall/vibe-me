import type { ExecuteOptions, ExecuteResult, ExecutorTimeoutType } from './types.js';

export const EXECUTOR_SUMMARIZER_SYSTEM_PROMPT =
  'You are the output summarizer for a one-shot executor tool.\n' +
  'A command was already executed synchronously with a strict timeout. You receive its full raw output.\n' +
  'Your ONLY job: produce a concise natural-language summary that helps the caller answer the original request.\n' +
  'You CANNOT call any tools that read or write files, list directories, or run further commands.\n' +
  'When done, reply with a single Markdown report — no tool calls.';

export function buildExecutorSummaryPrompt(
  options: Pick<ExecuteOptions, 'program' | 'language' | 'dependencies' | 'timeoutType'>,
  result: ExecuteResult,
): string {
  const depInfo = options.dependencies?.length ? `Dependencies: ${options.dependencies.join(', ')}\n\n` : '';
  const tagHeader = describeResultTag(result._tag, options.timeoutType);
  return [
    tagHeader,
    '',
    'Program:',
    options.program,
    '',
    depInfo.trimEnd(),
    depInfo ? '' : null,
    'Summarize the output. Highlight successes, failures, and key values. Do not invent details.',
    '',
    'Raw output:',
    result.output,
  ].filter(Boolean).join('\n');
}

function describeResultTag(tag: ExecuteResult['_tag'], timeoutType: ExecutorTimeoutType): string {
  switch (tag) {
    case 'Completed': return 'The following program has been executed (synchronous).';
    case 'Truncated': return `The following program exceeded the ${timeoutType} timeout and was killed. Partial output is below.`;
    case 'Failed': return 'The following program exited with a non-zero status.';
  }
}
