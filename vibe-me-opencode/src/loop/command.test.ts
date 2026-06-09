import { afterEach, describe, expect, mock, test } from 'bun:test';
import { activateReview, clearReviewSessions, isReviewActive } from 'engine/review';
import { createLoopCommandManager } from './index';
import { createMockContext, createOutput } from './test-utils';

afterEach(() => {
  clearReviewSessions();
});

describe('createLoopCommandManager', () => {
  describe('registerCommand', () => {
    test('registers the /loop command', () => {
      const manager = createLoopCommandManager(createMockContext());
      const config: Record<string, unknown> = {};

      manager.registerCommand(config);

      const commands = config.command as Record<
        string,
        { template: string; description: string }
      >;
      expect(commands.loop).toBeDefined();
      expect(commands.loop.description).toContain('review');
    });

    test('does not overwrite existing command', () => {
      const manager = createLoopCommandManager(createMockContext());
      const existing = { template: 'custom', description: 'custom' };
      const config: Record<string, unknown> = {
        command: { loop: existing },
      };

      manager.registerCommand(config);

      expect((config.command as Record<string, unknown>).loop).toBe(existing);
    });
  });

  describe('handleCommandExecuteBefore', () => {
    test('ignores non-loop commands', async () => {
      const manager = createLoopCommandManager(createMockContext());
      const output = createOutput();

      await manager.handleCommandExecuteBefore(
        { command: 'other', sessionID: 'ses-1', arguments: 'test' },
        output,
      );

      expect(output.parts).toHaveLength(1);
      expect(output.parts[0].text).toBe('template content');
    });

    test('swallows command with empty arguments', async () => {
      const manager = createLoopCommandManager(createMockContext());
      const output = createOutput();

      await manager.handleCommandExecuteBefore(
        { command: 'loop', sessionID: 'ses-1', arguments: '' },
        output,
      );

      expect(isReviewActive('ses-1')).toBe(false);
      expect(output.parts[0]?.text).toContain('cancelled');
    });

    test('rewrites task arguments into structured prompt', async () => {
      const manager = createLoopCommandManager(createMockContext());
      const output = createOutput();

      await manager.handleCommandExecuteBefore(
        {
          command: 'loop',
          sessionID: 'ses-1',
          arguments: 'Refactor the auth module',
        },
        output,
      );

      expect(isReviewActive('ses-1')).toBe(true);
      expect(output.parts[0]?.text).toContain('Refactor the auth module');
      expect(output.parts[0]?.text).toContain('loop mode is active');
      expect(output.parts[0]?.text).toContain('submit_review');
      expect(output.parts[0]?.text).toContain('affectedFiles');
    });

    test('does not toggle already active is a no-op', async () => {
      activateReview('ses-1', 'existing task');
      const manager = createLoopCommandManager(createMockContext());
      const output = createOutput();

      await manager.handleCommandExecuteBefore(
        {
          command: 'loop',
          sessionID: 'ses-1',
          arguments: 'some task',
        },
        output,
      );

      expect(isReviewActive('ses-1')).toBe(true);
      expect(output.parts[0]?.text).toContain('already active');
    });
  });
});
