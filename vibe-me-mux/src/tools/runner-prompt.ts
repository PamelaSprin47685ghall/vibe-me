import { buildRunnerPrompt } from "engine/runner";

export function buildMuxRunnerPrompt(
  args: { language: string; program: string; dependencies: string[] | undefined; whatToSummarize: string },
  exec: { output: string; background: boolean; jobId?: string },
): string {
  const message = exec.background
    ? `Job ID: ${exec.jobId}\n\nYou can use runner_wait to check for new output from the running process by passing the above jobId. Make sure to keep waiting until the task completes.`
    : undefined;
  return buildRunnerPrompt(
    args.language,
    args.program,
    args.dependencies,
    args.whatToSummarize,
    exec.output,
    exec.background,
    message,
  );
}
