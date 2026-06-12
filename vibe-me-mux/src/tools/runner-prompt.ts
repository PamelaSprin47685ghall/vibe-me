import { buildRunnerPrompt } from "engine/runner";
import type { ExecuteResult } from "engine/runner";

export function buildMuxRunnerPrompt(
  args: { language: string; program: string; dependencies: string[] | undefined; whatToSummarize: string },
  exec: ExecuteResult,
): string {
  return buildRunnerPrompt(
    args.language,
    args.program,
    args.dependencies,
    args.whatToSummarize,
    exec.output,
    exec._tag,
    exec._tag === 'Backgrounded' ? exec.jobId : undefined,
  );
}
