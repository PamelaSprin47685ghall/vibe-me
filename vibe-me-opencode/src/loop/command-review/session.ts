import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import type { LoopReviewDeps } from './types.js';

async function createPreReviewerSession(
  createSession: LoopReviewDeps['createSession'],
  directory: string,
  parentID: string | undefined,
): Promise<string | undefined> {
  const result = await createSession({
    query: { directory },
    body: { parentID, title: 'Pre-Reviewer' },
  });
  return result.data?.id;
}

export async function createAndRegisterChild(
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
