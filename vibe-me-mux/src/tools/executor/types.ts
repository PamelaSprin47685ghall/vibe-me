import type {
  ExecutorLanguage,
  ExecutorTimeoutType,
  execute,
} from 'engine/executor';
import type { PluginToolConfiguration } from '../../types/tool.js';
import type { ResolvedDelegatedAgentAiSettings } from '../resolveDelegatedAgentAiSettings.js';

export interface RawExecutorArgs {
  language: unknown;
  program: unknown;
  dependencies?: unknown;
  timeout_type: unknown;
}

export interface ValidatedExecutorArgs {
  program: string;
  language: ExecutorLanguage;
  dependencies: string[] | undefined;
  timeoutType: ExecutorTimeoutType;
}

export interface ExecutorToolDeps {
  execute: typeof execute;
  resolveAiSettings?: (
    config: PluginToolConfiguration,
    agentId: string,
  ) => Promise<ResolvedDelegatedAgentAiSettings>;
}
