import { createRunnerAbortTool } from './abort';
import { getRunnerConfig } from './config';
import { managedRunnerSessions } from './execute';
import { createRunnerNudgeHook } from './nudge';
import { createRunnerTool } from './tool';
import { createRunnerWaitTool } from './wait';
import { RUNNER_SYSTEM_PROMPT, createJobRegistry } from 'engine/runner';

export const opencodeRunnerJobs = createJobRegistry();

export {
  RUNNER_SYSTEM_PROMPT,
  managedRunnerSessions,
  createRunnerTool,
  createRunnerWaitTool,
  createRunnerAbortTool,
  getRunnerConfig,
  createRunnerNudgeHook,
};
