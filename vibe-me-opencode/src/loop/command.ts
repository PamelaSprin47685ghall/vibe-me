import type { PluginInput } from '@opencode-ai/plugin';
import {
  activateReview,
  addChild,
  deactivateReview,
  isReviewActive,
  REVIEW_INSTRUCTIONS,
} from 'engine/review';
import {
  registerChildAgent,
  resolveSubsessionParentID,
} from '../utils/child-agent';
import { COMMAND_NAME, LOOP_REVIEW_COMMAND_NAME } from './constants';
import { runReviewerWithNudge } from './reviewer';

export function createLoopCommandManager(_ctx: PluginInput) {
  function registerCommand(opencodeConfig: Record<string, unknown>): void {
    const configCommand = opencodeConfig.command as
      | Record<string, unknown>
      | undefined;
    if (!configCommand?.[COMMAND_NAME]) {
      if (!opencodeConfig.command) {
        opencodeConfig.command = {};
      }
      (opencodeConfig.command as Record<string, unknown>)[COMMAND_NAME] = {
        template: 'Enable loop mode.',
        description:
          'Enable loop mode — the next submission must pass through a reviewer before being accepted',
      };
    }

    if (!configCommand?.[LOOP_REVIEW_COMMAND_NAME]) {
      if (!opencodeConfig.command) {
        opencodeConfig.command = {};
      }
      (opencodeConfig.command as Record<string, unknown>)[
        LOOP_REVIEW_COMMAND_NAME
      ] = {
        template: 'Enable while-loop mode with pre-review.',
        description:
          'Enable while-loop mode — the task is pre-reviewed immediately, and reviewer feedback is prepended to your prompt before any work begins',
      };
    }
  }

  async function handleCommandExecuteBefore(
    input: {
      command: string;
      sessionID: string;
      arguments: string;
    },
    output: { parts: Array<{ type: string; text?: string }> },
  ): Promise<void> {
    if (input.command === LOOP_REVIEW_COMMAND_NAME) {
      output.parts.length = 0;

      const task = input.arguments.trim();
      if (!task) {
        deactivateReview(input.sessionID);
        output.parts.push({
          type: 'text',
          text: 'loop-review mode cancelled.',
        });
        return;
      }

      const sessionID = input.sessionID;

      if (isReviewActive(sessionID)) {
        output.parts.push({
          type: 'text',
          text: 'loop mode is already active. Submit your work via submit_review.',
        });
        return;
      }

      const client = _ctx.client;
      const directory = _ctx.directory;

      const parentID = resolveSubsessionParentID(sessionID);
      const createResult = await client.session.create({
        query: { directory },
        body: {
          parentID,
          title: 'Pre-Reviewer',
        },
      });
      const childID = createResult.data?.id;
      if (!childID) {
        output.parts.push({
          type: 'text',
          text: 'Failed to create pre-reviewer session',
        });
        return;
      }
      addChild(sessionID, childID);
      registerChildAgent(childID, 'reviewer', parentID);

      const parts: Array<{ type: 'text'; text: string }> = [
        { type: 'text', text: REVIEW_INSTRUCTIONS },
        { type: 'text', text: `=== Task ===\n\n${task}` },
      ];

      const result = await runReviewerWithNudge(
        client,
        childID,
        parts,
        directory,
      );

      if (result.feedback == null) {
        output.parts.push({
          type: 'text',
          text: `Pre-review passed. Task "${task}" already meets all criteria — no changes needed.`,
        });
        return;
      }

      if (result.terminated) {
        output.parts.push({
          type: 'text',
          text: `Pre-review could not complete. ${result.feedback}`,
        });
        return;
      }

      activateReview(sessionID, task);

      output.parts.push({
        type: 'text',
        text:
          `Task (loop-review): ${task}\n\n` +
          `=== Pre-review Feedback ===\n\n${result.feedback}\n\n` +
          'Address the feedback above, then call submit_review with:\n' +
          '- report: a detailed description of what you did and why\n' +
          '- affectedFiles: list of every file you modified or created\n\n' +
          'A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.',
      });
      return;
    }

    if (input.command !== COMMAND_NAME) return;

    output.parts.length = 0;

    const task = input.arguments.trim();
    if (!task) {
      deactivateReview(input.sessionID);
      output.parts.push({ type: 'text', text: 'loop mode cancelled.' });
      return;
    }

    const sessionID = input.sessionID;

    if (isReviewActive(sessionID)) {
      output.parts.push({
        type: 'text',
        text: 'loop mode is already active. Submit your work via submit_review.',
      });
      return;
    }

    activateReview(sessionID, task);

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

  return { registerCommand, handleCommandExecuteBefore };
}
