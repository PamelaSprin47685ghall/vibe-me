import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewResult, ReviewStore } from 'engine/review';
import { REVIEW_INSTRUCTIONS } from 'engine/review';
import {
  registerChildAgent as defaultRegisterChildAgent,
  resolveSubsessionParentID as defaultResolveSubsessionParentID,
} from '../utils/child-agent';
import { LOOP_REVIEW_COMMAND_NAME } from './constants';
import { runReviewerWithNudge as defaultRunReviewerWithNudge } from './reviewer';

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

export interface LoopReviewDeps {
  createSession: CreateSessionFn;
  runReviewerWithNudge: typeof defaultRunReviewerWithNudge;
  registerChildAgent: typeof defaultRegisterChildAgent;
  resolveSubsessionParentID: typeof defaultResolveSubsessionParentID;
  loopReviewCommandName: string;
  reviewInstructions: string;
  now: () => number;
}

function defaultDeps(ctx: PluginInput): LoopReviewDeps {
  return {
    createSession: (input) => ctx.client.session.create(input),
    runReviewerWithNudge: defaultRunReviewerWithNudge,
    registerChildAgent: defaultRegisterChildAgent,
    resolveSubsessionParentID: defaultResolveSubsessionParentID,
    loopReviewCommandName: LOOP_REVIEW_COMMAND_NAME,
    reviewInstructions: REVIEW_INSTRUCTIONS,
    now: Date.now,
  };
}

function isLoopReviewCommand(
  command: string,
  loopReviewCommandName: string,
): boolean {
  return command === loopReviewCommandName;
}

function parseTask(rawArguments: string): string {
  return rawArguments.trim();
}

async function createPreReviewerSession(
  createSession: CreateSessionFn,
  directory: string,
  parentID: string | undefined,
): Promise<string | undefined> {
  const result = await createSession({
    query: { directory },
    body: { parentID, title: 'Pre-Reviewer' },
  });
  return result.data?.id;
}

function buildPreReviewParts(
  reviewInstructions: string,
  task: string,
): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: reviewInstructions },
    { type: 'text', text: `=== Task ===\n\n${task}` },
  ];
}

function formatAcceptedResult(task: string): string {
  return (
    `Pre-review passed. Task "${task}" already meets all criteria` +
    ` — no changes needed.`
  );
}

function formatTerminatedResult(): string {
  return 'Pre-review could not complete.';
}

function formatFeedbackResult(task: string, feedback: string): string {
  return (
    `Task (loop-review): ${task}\n\n` +
    `=== Pre-review Feedback ===\n\n${feedback}\n\n` +
    'Address the feedback above, then call submit_review with:\n' +
    '- report: a detailed description of what you did and why\n' +
    '- affectedFiles: list of every file you modified or created\n\n' +
    'A reviewer will examine your submission. If accepted, you are done.' +
    ' If rejected, you will receive specific feedback to address.'
  );
}

async function createAndRegisterChild(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  sessionID: string,
  deps: LoopReviewDeps,
): Promise<string | undefined> {
  const parentID = deps.resolveSubsessionParentID(sessionID);
  const childID = await createPreReviewerSession(
    deps.createSession,
    ctx.directory,
    parentID,
  );
  if (!childID) return undefined;

  reviewStore.addChild(sessionID, childID);
  deps.registerChildAgent(childID, 'reviewer', parentID);
  return childID;
}

function handleReviewResult(
  reviewStore: ReviewStore,
  sessionID: string,
  task: string,
  result: ReviewResult,
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps,
): void {
  if (result._tag === 'Accepted') {
    output.parts.push({ type: 'text', text: formatAcceptedResult(task) });
    return;
  }

  if (result._tag === 'Terminated') {
    output.parts.push({ type: 'text', text: formatTerminatedResult() });
    return;
  }

  reviewStore.activateReview(sessionID, task, deps.now());
  output.parts.push({
    type: 'text',
    text: formatFeedbackResult(task, result.feedback),
  });
}

async function runPreReview(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  sessionID: string,
  task: string,
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps,
): Promise<void> {
  const childID = await createAndRegisterChild(
    ctx,
    reviewStore,
    sessionID,
    deps,
  );
  if (!childID) {
    output.parts.push({
      type: 'text',
      text: 'Failed to create pre-reviewer session',
    });
    return;
  }

  const parts = buildPreReviewParts(deps.reviewInstructions, task);
  const result = await deps.runReviewerWithNudge(
    ctx.client,
    reviewStore,
    childID,
    parts,
  );

  handleReviewResult(reviewStore, sessionID, task, result, output, deps);
}

export async function handleLoopReview(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  input: { command: string; sessionID: string; arguments: string },
  output: { parts: Array<{ type: string; text?: string }> },
  deps: LoopReviewDeps = defaultDeps(ctx),
): Promise<void> {
  if (!isLoopReviewCommand(input.command, deps.loopReviewCommandName)) return;

  output.parts.length = 0;

  const task = parseTask(input.arguments);
  if (!task) {
    reviewStore.deactivateReview(input.sessionID);
    output.parts.push({
      type: 'text',
      text: 'loop-review mode cancelled.',
    });
    return;
  }

  if (reviewStore.isReviewActive(input.sessionID)) {
    output.parts.push({
      type: 'text',
      text: 'loop mode is already active. Submit your work via submit_review.',
    });
    return;
  }

  await runPreReview(ctx, reviewStore, input.sessionID, task, output, deps);
}
