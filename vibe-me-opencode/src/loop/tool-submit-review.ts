import type {
  PluginInput,
  ToolContext,
  ToolDefinition,
} from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin/tool';
import type { ReviewResult, ReviewStore } from 'engine/review';
import { REVIEW_INSTRUCTIONS } from 'engine/review';
import {
  registerChildAgent as defaultRegisterChildAgent,
  resolveSubsessionParentID as defaultResolveSubsessionParentID,
} from '../utils/child-agent';
import { extractToolContext as defaultExtractToolContext } from '../utils/tool-context';
import { runReviewerWithNudge as defaultRunReviewerWithNudge } from './reviewer';

interface SubmitReviewArgs {
  report: string;
  affectedFiles: string[];
}

type CreateSessionInput = {
  query: { directory: string };
  body: { parentID?: string; title: string };
};

type CreateSessionResult = {
  data?: { id?: string } | null;
};

type CreateSessionFn = (
  input: CreateSessionInput,
) => Promise<CreateSessionResult>;

export interface SubmitReviewDeps {
  createSession: CreateSessionFn;
  runReviewerWithNudge: typeof defaultRunReviewerWithNudge;
  registerChildAgent: typeof defaultRegisterChildAgent;
  resolveSubsessionParentID: typeof defaultResolveSubsessionParentID;
  extractToolContext: typeof defaultExtractToolContext;
}

function defaultDeps(ctx: PluginInput): SubmitReviewDeps {
  return {
    createSession: (input) => ctx.client.session.create(input),
    runReviewerWithNudge: defaultRunReviewerWithNudge,
    registerChildAgent: defaultRegisterChildAgent,
    resolveSubsessionParentID: defaultResolveSubsessionParentID,
    extractToolContext: defaultExtractToolContext,
  };
}

function buildReviewParts(
  report: string,
  affectedFiles: string[],
  task: string | undefined,
): Array<{ type: 'text'; text: string }> {
  const sections = [
    REVIEW_INSTRUCTIONS,
    `=== Change Report ===\n\n${report}`,
    `=== Affected Files ===\n\n${affectedFiles.join('\n')}`,
    task ? `=== Original Task ===\n\n${task}` : null,
  ];
  return sections
    .filter((text): text is string => text !== null)
    .map((text) => ({ type: 'text' as const, text }));
}

async function createReviewerSession(
  createSession: CreateSessionFn,
  directory: string,
  parentID: string | undefined,
): Promise<string | undefined> {
  const createResult = await createSession({
    query: { directory },
    body: { parentID, title: 'Reviewer' },
  });
  return createResult.data?.id;
}

function formatReviewResult(result: ReviewResult): string {
  if (result._tag === 'Accepted') {
    return 'Review passed. Your changes have been accepted. loop mode has ended.';
  }
  if (result._tag === 'Terminated') {
    return 'Review terminated.';
  }
  return `Review feedback:\n\n${result.feedback}\n\nAddress the feedback above. loop mode is still active — fix the issues and call submit_review again.`;
}

async function runSubmitReview(
  args: SubmitReviewArgs,
  ctx: PluginInput,
  reviewStore: ReviewStore,
  deps: SubmitReviewDeps,
  sessionID: string,
  directory: string,
  abortSignal: AbortSignal | undefined,
): Promise<string> {
  const task = reviewStore.getReviewTask(sessionID);
  const parts = buildReviewParts(args.report, args.affectedFiles, task);
  const parentID = deps.resolveSubsessionParentID(sessionID);
  const childID = await createReviewerSession(
    deps.createSession,
    directory,
    parentID,
  );

  if (!childID) {
    return 'Failed to create reviewer session';
  }

  reviewStore.addChild(sessionID, childID);
  deps.registerChildAgent(childID, 'reviewer', parentID);

  const result = await deps.runReviewerWithNudge(
    ctx.client,
    reviewStore,
    childID,
    parts,
    abortSignal,
  );

  if (result._tag === 'Accepted' || result._tag === 'Terminated') {
    reviewStore.deactivateReview(sessionID);
  }

  return formatReviewResult(result);
}

async function executeSubmitReview(
  args: SubmitReviewArgs,
  context: ToolContext,
  ctx: PluginInput,
  reviewStore: ReviewStore,
  deps: SubmitReviewDeps,
): Promise<string> {
  const { directory, sessionID, abortSignal } = deps.extractToolContext(
    context,
    ctx.directory,
  );

  if (!sessionID || !reviewStore.isReviewActive(sessionID)) {
    return 'You do not need review. Just continue with your work.';
  }

  if (!reviewStore.tryLockReview(sessionID)) {
    return 'A review is already in progress. Wait for it to finish.';
  }

  try {
    return await runSubmitReview(
      args,
      ctx,
      reviewStore,
      deps,
      sessionID,
      directory,
      abortSignal,
    );
  } finally {
    reviewStore.unlockReview(sessionID);
  }
}

export function createSubmitReviewTool(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  deps: SubmitReviewDeps = defaultDeps(ctx),
): ToolDefinition {
  return tool({
    description:
      'Submit work for review. Only available during loop mode (activated by /loop).',
    args: {
      report: tool.schema
        .string()
        .min(1)
        .describe('Detailed report of what was done'),
      affectedFiles: tool.schema
        .array(tool.schema.string())
        .describe('List of file paths that were modified or created'),
    },
    execute: (args, context) =>
      executeSubmitReview(args, context, ctx, reviewStore, deps),
  });
}
