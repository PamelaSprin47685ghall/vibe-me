import { createChildSession, readAssistantText, runSubagent } from './agent-session.js';
import { appendCapsContext, buildCapsContext, stripHostAgentsPrompt } from './caps.js';
import { globalIteratorStore } from 'engine/util';
import { _test as fuzzyTest, createFuzzyFindTool, createFuzzyGrepTool, resetFuzzyState } from './fuzzy.js';
import { isReviewActive, LOOP_TOOL_NAMES, registerLoopFeatures, resetReviewStates, setPendingReviewStateForTest } from './loop.js';
import { clearNudgeSession, handleLoopNudge, handleRunnerNudge } from './nudge.js';
import { getOllamaKey, registerOllamaTools } from './ollama.js';
import { patchDisablePrune } from './prune.js';
import { hasRunningRunnerJob, registerRunnerTools, resetRunnerJobs, RUNNER_TOOL_NAMES, setRunnerJobStateForTest, stripHeadTailPipes } from './runner.js';
import { asErrorResult, getSessionIdFromContext, stringArraySchema } from './shared.js';
import { registerSubagentTools, SUBAGENT_TOOL_NAMES } from './subagents.js';
import { appendSyntaxDiagnostics, checkSyntax, supportsSyntaxDiagnosticsTool } from './tree-sitter.js';

const registered = new WeakSet();

patchDisablePrune().catch(() => {});

const CHILD_ONLY_TOOLS: Record<string, true> = {
    'find': true,
    'edit': true,
    'write': true,
    'lsp': true,
    'fuzzy_find': true,
    'fuzzy_grep': true,
    'runner_wait': true,
    'runner_abort': true,
    'submit_review_result': true,
    'browser': true,
    'search': true,
    'glob': true,
};

export default async function kunweiExtension(pi) {
    if (registered.has(pi)) return;
    registered.add(pi);

    const sharedHelpers = {
        asErrorResult,
        createChildSession,
        getSessionIdFromContext,
        readAssistantText,
        runSubagent,
        stringArraySchema,
    };

    pi.on('before_agent_start', async (event, ctx) => {
        const sp = stripHostAgentsPrompt(event.systemPrompt);
        const prefix = Array.isArray(sp) ? sp : [sp];
        const capsContext = await buildCapsContext(ctx.cwd);
        if (!capsContext) return { systemPrompt: prefix };
        return { systemPrompt: [capsContext, ...prefix] };
    });

    pi.on('tool_result', (event, ctx) => appendSyntaxDiagnostics(ctx.cwd, event));


    pi.on('agent_end', (_event, ctx) => {
        const sessionId = getSessionIdFromContext(ctx);
        if (!sessionId) return;
        if (hasRunningRunnerJob(sessionId)) {
            handleRunnerNudge(pi, null, sessionId, hasRunningRunnerJob);
            return;
        }
        if (isReviewActive(sessionId) && !ctx.hasPendingMessages?.()) {
            handleLoopNudge(pi, null, sessionId, ctx.sessionManager, isReviewActive);
            return;
        }
    });

    pi.on('session_shutdown', (_event, ctx) => {
        const sessionId = getSessionIdFromContext(ctx);
        if (!sessionId) return;
        clearNudgeSession(sessionId);
        globalIteratorStore.clearScope(sessionId);
    });

    pi.on('session_start', async () => {
        const activeTools = pi.getActiveTools();
        // Disable built-in bash tool for all agents
        let filtered = activeTools.filter((toolName) => toolName !== 'bash');
        const activeSet = new Set(filtered);
        // Main session has delegation tools like editor/greper in its active set.
        // Child sessions (via createChildSession) have only their explicitly given tools.
        const isMainSession = SUBAGENT_TOOL_NAMES.some((name) => activeSet.has(name));
        if (isMainSession) {
            filtered = filtered.filter((toolName) => !CHILD_ONLY_TOOLS[toolName]);
        }
        if (filtered.length !== activeTools.length) {
            await pi.setActiveTools(filtered);
        }
    });

    registerLoopFeatures(pi, sharedHelpers);
    registerSubagentTools(pi, sharedHelpers);
    registerOllamaTools(pi, sharedHelpers);

    pi.registerTool(createFuzzyFindTool(pi));
    pi.registerTool(createFuzzyGrepTool(pi));

    registerRunnerTools(pi, sharedHelpers);
}

export const _test = {
    appendCapsContext,
    buildCapsContext,
    checkSyntax,
    fuzzy: fuzzyTest,
    getOllamaKey,
    reset() {
        resetReviewStates();
        resetRunnerJobs();
        resetFuzzyState();
    },
    setPendingReviewStateForTest,
    setRunnerJobStateForTest,
    stripHeadTailPipes,
    stripHostAgentsPrompt,
    supportsSyntaxDiagnosticsTool,
};
