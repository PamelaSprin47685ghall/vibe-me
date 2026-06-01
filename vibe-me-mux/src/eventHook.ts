import { createAbortSuppressor } from "engine/util";
import { deactivateReview } from "engine/review";
import { cleanupJob, getActiveJobs } from "engine/runner";
import type { AddonEventHook } from "./types/tool";

export function createEventHook(): AddonEventHook {
  const abortSuppressors = new Map<
    string,
    ReturnType<typeof createAbortSuppressor>
  >();

  function getOrCreateSuppressor(workspaceId: string) {
    let sup = abortSuppressors.get(workspaceId);
    if (!sup) {
      sup = createAbortSuppressor(30_000);
      abortSuppressors.set(workspaceId, sup);
    }
    return sup;
  }

  return (event) => {
    const { type, workspaceId } = event;
    if (!workspaceId) return;

    switch (type) {
      case "stream-end":
        break;
      case "stream-abort":
        for (const [jobId] of getActiveJobs()) {
          if (jobId.startsWith(workspaceId + "/")) cleanupJob(jobId);
        }
        deactivateReview(workspaceId);
        abortSuppressors.delete(workspaceId);
        break;
      case "error":
        if (event.properties?.errorType === "aborted") {
          getOrCreateSuppressor(workspaceId).suppress();
        }
        break;
    }
  };
}
