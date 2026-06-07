import { getCodingAgentModule } from './pi-resolve.js';
import { createAbortError, type ChildSession, type CreateChildSessionConfig, type PiLike, type PluginContext, type ReadAssistantTextOptions, type RunSubagentConfig, type SessionEntry, type SessionManagerLike } from './shared.js';

export function readAssistantText(sessionManager: SessionManagerLike, { startIndex = 0, joiner = '\n\n' }: ReadAssistantTextOptions = {}): string | null {
    const entries = sessionManager?.getEntries?.() ?? [];
    const chunks: string[] = [];
    for (let index = startIndex; index < entries.length; index += 1) {
        const entry = entries[index] as SessionEntry | undefined;
        const role = entry?.message?.role ?? entry?.info?.role;
        if (role !== 'assistant') continue;
        const content = entry?.message?.content ?? entry?.parts ?? [];
        for (const part of content) {
            if (part?.type === 'text' && part.text) chunks.push(part.text);
        }
    }
    return chunks.length > 0 ? chunks.join(joiner) : null;
}

export async function runSubagent(pi: PiLike, ctx: PluginContext, config: RunSubagentConfig): Promise<string> {
    const child = await createChildSession(pi, ctx, config);
    const { promise: abortPromise, reject } = config.signal
        ? Promise.withResolvers<string>()
        : { promise: null, reject: null };

    if (config.signal) {
        if (config.signal.aborted) {
            reject?.(createAbortError());
        } else {
            config.signal.addEventListener('abort', () => {
                reject?.(createAbortError());
            }, { once: true });
        }
    }

    const wrap = <T>(promise: Promise<T>) => abortPromise ? Promise.race<T | string>([promise, abortPromise]) : promise;

    try {
        await wrap(child.session.prompt(config.prompt));
        if (config.waitForResult) return await wrap(config.waitForResult(child.session, child.dispose)) as string;
        await wrap(child.session.waitForIdle());
        return readAssistantText(child.session.sessionManager) ?? '(no output)';
    } finally {
        if (!config.waitForResult) {
            child.session.abort?.();
            child.dispose?.();
        }
    }
}

export async function createChildSession(pi: PiLike, ctx: PluginContext, config: CreateChildSessionConfig): Promise<ChildSession> {
    const createAgentSession = pi?.pi?.createAgentSession;
    if (!createAgentSession) throw new Error('createAgentSession unavailable');
    const { SessionManager } = await getCodingAgentModule();
    return await createAgentSession({
        cwd: ctx?.cwd ?? process.cwd(),
        hasUI: false,
        toolNames: config.toolNames,
        modelRegistry: ctx?.modelRegistry,
        model: ctx?.model,
        thinkingLevel: ctx?.getThinkingLevel?.(),
        systemPrompt: config.systemPrompt ?? ctx?.getSystemPrompt?.(),
        agentsMdSearch: ctx?.agentsMdSearch,
        workspaceTree: ctx?.workspaceTree,
        sessionManager: SessionManager.create(ctx?.cwd ?? process.cwd()),
        customTools: config.customTools || [],
    });
}
