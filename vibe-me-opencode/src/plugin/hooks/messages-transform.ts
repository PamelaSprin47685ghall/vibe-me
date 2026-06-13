import type {
  CapsInjector,
  NudgeCoordinator,
  ToolOutputDeduper,
} from './types.js';

export async function runMessagesTransform(
  capsInjector: CapsInjector,
  toolOutputDeduper: ToolOutputDeduper,
  nudgeHook: NudgeCoordinator,
  output: { messages: unknown[] },
): Promise<void> {
  await capsInjector.handleMessagesTransform(output);
  await toolOutputDeduper.handleMessagesTransform(output);
  await nudgeHook.handleMessagesTransform({ messages: output.messages });
}
