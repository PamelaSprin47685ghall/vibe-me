import type { PluginInput } from '@opencode-ai/plugin';
import type {
  ExecutorLanguage,
  ExecutorTimeoutType,
  execute,
} from 'engine/executor';

export interface ExecutorArgs {
  language: ExecutorLanguage;
  program: string;
  dependencies?: string[];
  timeout_type: ExecutorTimeoutType;
}

export interface CreateExecutorToolDeps {
  execute: typeof execute;
  createSummarizerSession: (
    client: PluginInput['client'],
    sessionID: string | undefined,
    directory: string,
  ) => Promise<{ childID: string; parentID: string | undefined }>;
  awaitSummarizerReport: (
    client: PluginInput['client'],
    childID: string,
    prompt: string,
    directory: string,
    abortSignal: AbortSignal | undefined,
  ) => Promise<string>;
  extractToolContext: (
    context: unknown,
    fallbackDirectory: string,
  ) => {
    directory: string;
    sessionID: string | undefined;
    abortSignal: AbortSignal | undefined;
  };
  resolveSubsessionParentID: (sessionID?: string) => string | undefined;
  isAbortError: (err: unknown) => boolean;
}
