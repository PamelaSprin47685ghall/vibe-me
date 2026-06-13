import type { PluginInput } from '@opencode-ai/plugin';
import type { NudgeShellState } from 'engine/nudge-shell';
import type { ReviewStore } from 'engine/review';

export type EventHandler = (
  state: NudgeShellState,
  props: Record<string, unknown>,
  sessionID: string,
  ctx: PluginInput,
  reviewStore: ReviewStore,
) => NudgeShellState | Promise<NudgeShellState>;
