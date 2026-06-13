import type { PluginInput } from '@opencode-ai/plugin';
import { REVIEW_INSTRUCTIONS } from 'engine/review';
import {
  registerChildAgent as defaultRegisterChildAgent,
  resolveSubsessionParentID as defaultResolveSubsessionParentID,
} from '../../utils/child-agent';
import { LOOP_REVIEW_COMMAND_NAME } from '../constants';
import { runReviewerWithNudge as defaultRunReviewerWithNudge } from '../reviewer';

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

export function defaultDeps(ctx: PluginInput): LoopReviewDeps {
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
