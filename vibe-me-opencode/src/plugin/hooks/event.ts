import type { EventInput, NudgeCoordinator } from './types.js';

export function createEventHandler(nudgeHook: NudgeCoordinator) {
  return async (input: EventInput): Promise<void> => {
    await nudgeHook.handleEvent(input);
  };
}
