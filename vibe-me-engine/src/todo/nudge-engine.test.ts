import { describe, test, expect } from 'bun:test';
import { decideNudgeAction, type NudgeInput } from './nudge-engine';

describe('Nudge Decision Engine', () => {
  test('nudges for running job', () => {
    const input: NudgeInput = {
      hasPendingTodos: false,
      hasRunningJob: true,
      isLoopActive: false,
      lastMessageText: '',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('nudge-runner');
  });

  test('nudges for pending todos', () => {
    const input: NudgeInput = {
      hasPendingTodos: true,
      hasRunningJob: false,
      isLoopActive: false,
      lastMessageText: '',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('nudge-todo');
  });

  test('skips todo nudge with skip tag', () => {
    const input: NudgeInput = {
      hasPendingTodos: true,
      hasRunningJob: false,
      isLoopActive: false,
      lastMessageText: '<skip-todo-check />',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('none');
  });

  test('nudges for active loop', () => {
    const input: NudgeInput = {
      hasPendingTodos: false,
      hasRunningJob: false,
      isLoopActive: true,
      lastMessageText: '',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('nudge-loop');
  });

  test('skips loop nudge with skip tag', () => {
    const input: NudgeInput = {
      hasPendingTodos: false,
      hasRunningJob: false,
      isLoopActive: true,
      lastMessageText: '<skip-loop-check />',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('none');
  });

  test('returns none when no conditions met', () => {
    const input: NudgeInput = {
      hasPendingTodos: false,
      hasRunningJob: false,
      isLoopActive: false,
      lastMessageText: '',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('none');
  });

  test('runner takes priority over todos', () => {
    const input: NudgeInput = {
      hasPendingTodos: true,
      hasRunningJob: true,
      isLoopActive: false,
      lastMessageText: '',
      entryCount: 10,
      lastNudgeEntry: 5,
    };
    
    expect(decideNudgeAction(input)).toBe('nudge-runner');
  });
});
