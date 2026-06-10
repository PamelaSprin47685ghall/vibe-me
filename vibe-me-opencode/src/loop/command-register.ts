import { COMMAND_NAME, LOOP_REVIEW_COMMAND_NAME } from './constants';

export function registerCommand(opencodeConfig: Record<string, unknown>): void {
  const configCommand = opencodeConfig.command as
    | Record<string, unknown>
    | undefined;

  if (!configCommand?.[COMMAND_NAME]) {
    if (!opencodeConfig.command) opencodeConfig.command = {};
    (opencodeConfig.command as Record<string, unknown>)[COMMAND_NAME] = {
      template: 'Enable loop mode.',
      description:
        'Enable loop mode — the next submission must pass through a reviewer before being accepted',
    };
  }

  if (!configCommand?.[LOOP_REVIEW_COMMAND_NAME]) {
    if (!opencodeConfig.command) opencodeConfig.command = {};
    (opencodeConfig.command as Record<string, unknown>)[
      LOOP_REVIEW_COMMAND_NAME
    ] = {
      template: 'Enable while-loop mode with pre-review.',
      description:
        'Enable while-loop mode — the task is pre-reviewed immediately, and reviewer feedback is prepended to your prompt before any work begins',
    };
  }
}