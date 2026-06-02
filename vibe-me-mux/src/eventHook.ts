import { createAbortSuppressor, globalIteratorStore } from "engine/util";
import { deactivateReview } from "engine/review";
import { cleanupJob, getActiveJobs } from "engine/runner";
import type { PluginEventHook } from "./types/tool";

export function createEventHook(): PluginEventHook {
  const suppressors = new Map<string, ReturnType<typeof createAbortSuppressor>>();

  return (event) => {
    const { type, workspaceId } = event;
    if (!workspaceId) return;

    switch (type) {
      case "stream-abort":
        for (const [jobId] of getActiveJobs()) {
          if (jobId.startsWith(workspaceId + "/")) cleanupJob(jobId);
        }
        deactivateReview(workspaceId);
        globalIteratorStore.clearScope(workspaceId);
        suppressors.delete(workspaceId);
        break;
      case "error":
        if ((event.properties as { readonly errorType?: string } | undefined)?.errorType === "aborted") {
          let sup = suppressors.get(workspaceId);
          if (!sup) {
            sup = createAbortSuppressor(30_000);
            suppressors.set(workspaceId, sup);
          }
          sup.suppress();
        }
        break;
    }
  };
}
