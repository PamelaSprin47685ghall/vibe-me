import fs from 'node:fs';
import {
  RUNNER_MAX_WAIT_MS,
  RUNNER_MIN_WAIT_MS,
  RUNNER_LANGUAGES,
  RUNNER_SYSTEM_PROMPT,
  abort,
  buildRunnerPrompt,
  cleanupJob,
  execute,
  getActiveJobs,
  getRunnerLogPath,
  hasActiveJob,
  stripHeadTailPipes,
  wait,
  type ExecuteResult,
  type RunnerLanguage,
} from 'engine/runner';
import { createAbortError, hasErrorName, type PiLike, type PluginContext, type SharedHelpers, type ToolResult } from './shared.js';

export { stripHeadTailPipes };

export const RUNNER_TOOL_NAMES = ['runner', 'runner_wait', 'runner_abort'];

const runnerJobs = new Map<string, { status: string }>();

export async function cleanupRunnerJob(sessionId: string) {
  await cleanupJob(sessionId);
  runnerJobs.delete(sessionId);
}

export function resetRunnerJobs() {
  for (const sessionId of [...runnerJobs.keys()]) cleanupRunnerJob(sessionId).catch(() => {});
  runnerJobs.clear();
}

export function hasRunningRunnerJob(sessionId: string) {
  return hasActiveJob(getActiveJobs, sessionId) || runnerJobs.has(sessionId);
}

export function setRunnerJobStateForTest(sessionId: string, status = 'running') {
  const logPath = getRunnerLogPath(`test-${sessionId}`);
  fs.writeFileSync(logPath, '');
  runnerJobs.set(sessionId, { status });
}

export async function waitRunnerJob(sessionId: string, ms: number) {
  return await wait({ sessionId, ms });
}

function isRunnerLanguage(language: string | undefined): language is RunnerLanguage {
  return typeof language === 'string' && (RUNNER_LANGUAGES as readonly string[]).includes(language);
}

export function registerRunnerTools(pi: PiLike, helpers: SharedHelpers) {
  const { asErrorResult, createChildSession, getSessionIdFromContext, readAssistantText } = helpers;

  pi.on('session_shutdown', (_event: unknown, ctx: PluginContext) => {
    const sessionId = getSessionIdFromContext(ctx);
    if (sessionId) cleanupRunnerJob(sessionId).catch(() => {});
  });

  pi.registerTool({
    name: 'runner',
    label: 'Runner',
    description: 'Execute shell, Python, or JavaScript and return a summary, with background wait/abort support.',
    parameters: pi.typebox.Type.Object({
      language: pi.typebox.Type.Optional(pi.typebox.Type.Enum(RUNNER_LANGUAGES, { description: 'shell, python, or javascript' })),
      program: pi.typebox.Type.String({ description: 'Shell command, Python code, or JavaScript/TypeScript code.' }),
      dependencies: pi.typebox.Type.Optional(pi.typebox.Type.Array(pi.typebox.Type.String({ description: 'Language dependencies.' }))),
      what_to_summarize: pi.typebox.Type.String({ description: 'What to summarize from output.' }),
    }),
    async execute(_toolCallId: string, params: { language?: string; program: string; dependencies?: string[]; what_to_summarize: string }, signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      const language: RunnerLanguage = isRunnerLanguage(params.language) ? params.language : 'shell';
      try {
        const child = await createChildSession(pi, ctx, {
          toolNames: ['runner_wait', 'runner_abort'],
          systemPrompt: [RUNNER_SYSTEM_PROMPT, ...(ctx?.getSystemPrompt?.() || [])],
        });
        try {
          const childSessionId = child.session.sessionManager.getSessionId?.();
          if (!childSessionId) throw new Error('Runner child session unavailable');
          const { promise: abortPromise, reject } = signal
            ? Promise.withResolvers<never>()
            : { promise: null, reject: null };

          if (signal) {
            if (signal.aborted) {
              abort(childSessionId);
              reject?.(createAbortError());
            } else {
              signal.addEventListener('abort', () => {
                abort(childSessionId);
                reject?.(createAbortError());
              }, { once: true });
            }
          }

          const wrap = <T>(promise: Promise<T>) => abortPromise ? Promise.race([promise, abortPromise]) : promise;

          const runResult: ExecuteResult = await wrap(execute({
            sessionId: childSessionId,
            program: params.program,
            language,
            dependencies: params.dependencies,
            cwd: ctx.cwd,
            earlyTimeoutMs: RUNNER_MAX_WAIT_MS * 120,
          }));
          await wrap(child.session.prompt(buildRunnerPrompt(language, params.program, params.dependencies, params.what_to_summarize, runResult.output, runResult.background, runResult.message)));
          await wrap(child.session.waitForIdle());
          return { content: [{ type: 'text', text: readAssistantText(child.session.sessionManager) ?? '(no output)' }] };
        } finally {
          child.session.abort?.();
          child.dispose?.();
        }
      } catch (error) {
        if (hasErrorName(error, 'AbortError')) {
          return { content: [{ type: 'text', text: 'Runner aborted.' }] };
        }
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'runner_wait',
    label: 'Runner Wait',
    description: 'Wait for background runner output.',
    defaultInactive: true,
    parameters: pi.typebox.Type.Object({
      ms: pi.typebox.Type.Optional(pi.typebox.Type.Number({ description: 'Wait time in milliseconds.' })),
    }),
    async execute(_toolCallId: string, params: { ms?: number }, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      const sessionId = getSessionIdFromContext(ctx);
      if (!sessionId) return { content: [{ type: 'text', text: 'No runner session found.' }], isError: true };
      try {
        const waitMs = Math.max(RUNNER_MIN_WAIT_MS, Math.min(RUNNER_MAX_WAIT_MS, params.ms ?? 2000));
        const result = await wait({ sessionId, ms: waitMs });
        return { content: [{ type: 'text', text: [result.output, result.message].filter(Boolean).join('\n\n') || '(no new output)' }] };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });

  pi.registerTool({
    name: 'runner_abort',
    label: 'Runner Abort',
    description: 'Abort background runner task.',
    defaultInactive: true,
    parameters: pi.typebox.Type.Object({}),
    async execute(_toolCallId: string, _params: Record<string, never>, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: PluginContext): Promise<ToolResult> {
      const sessionId = getSessionIdFromContext(ctx);
      if (!sessionId) return { content: [{ type: 'text', text: 'No runner session found.' }], isError: true };
      try {
        return { content: [{ type: 'text', text: abort(sessionId) }] };
      } catch (error) {
        return asErrorResult(error);
      }
    },
  });
}
