import { activateReview, deactivateReview, isReviewActive } from 'engine/review';
import { COMMAND_NAME } from './constants';

export async function handleLoop(
  input: { command: string; sessionID: string; arguments: string },
  output: { parts: Array<{ type: string; text?: string }> },
): Promise<void> {
  if (input.command !== COMMAND_NAME) return;

  output.parts.length = 0;

  const task = input.arguments.trim();
  if (!task) {
    deactivateReview(input.sessionID);
    output.parts.push({ type: 'text', text: 'loop mode cancelled.' });
    return;
  }

  if (isReviewActive(input.sessionID)) {
    output.parts.push({
      type: 'text',
      text: 'loop mode is already active. Submit your work via submit_review.',
    });
    return;
  }

  activateReview(input.sessionID, task);

  output.parts.push({
    type: 'text',
    text:
      `Task (loop): ${task}\n\n` +
      'loop mode is active. Complete the task above, then call submit_review with:\n' +
      '- report: a detailed description of what you did and why\n' +
      '- affectedFiles: list of every file you modified or created\n\n' +
      'A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.',
  });
}