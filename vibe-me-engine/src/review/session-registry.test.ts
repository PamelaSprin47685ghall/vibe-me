import { describe, expect, it } from 'bun:test';
import {
  emptyRegistry,
  reduce,
  sessionIsActive,
  taskOf,
  stateOf,
  canTransition,
} from './session-registry.js';

describe('SessionRegistry pure reducer', () => {
  describe('reduce', () => {
    it('activates a new session', () => {
      const r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 'refactor' });
      expect(sessionIsActive(r, 's1')).toBe(true);
      expect(taskOf(r, 's1')).toBe('refactor');
    });

    it('lock transitions to Locked', () => {
      const r0 = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      const r1 = reduce(r0, { type: 'lock', id: 's1', reviewerId: 'r1' });
      expect(sessionIsActive(r1, 's1')).toBe(true);
      expect(stateOf(r1, 's1')?._tag).toBe('Locked');
    });

    it('unlock returns to Active', () => {
      let r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      r = reduce(r, { type: 'lock', id: 's1', reviewerId: 'r1' });
      r = reduce(r, { type: 'unlock', id: 's1' });
      expect(stateOf(r, 's1')?._tag).toBe('Active');
    });

    it('complete transitions to Completed', () => {
      let r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      r = reduce(r, { type: 'complete', id: 's1', accepted: true });
      expect(sessionIsActive(r, 's1')).toBe(false);
      expect(stateOf(r, 's1')?._tag).toBe('Completed');
    });

    it('deactivate removes session', () => {
      const r0 = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      const r1 = reduce(r0, { type: 'deactivate', id: 's1' });
      expect(r1.has('s1')).toBe(false);
    });

    it('clear empties all sessions', () => {
      let r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 'a' });
      r = reduce(r, { type: 'activate', id: 's2', task: 'b' });
      r = reduce(r, { type: 'clear' });
      expect(r.size).toBe(0);
    });

    it('evict removes stale sessions', () => {
      const cutoff = Date.now() + 1;
      let r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      r = reduce(r, { type: 'evict', cutoff });
      expect(r.size).toBe(0);
    });

    it('setFeedback updates feedback', () => {
      let r = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      r = reduce(r, { type: 'setFeedback', id: 's1', feedback: 'fix this' });
      expect(r.get('s1')?.lastFeedback).toBe('fix this');
    });

    it('addChild adds child to parent', () => {
      let r = reduce(emptyRegistry(), { type: 'activate', id: 'p1', task: 'parent' });
      r = reduce(r, { type: 'addChild', parentId: 'p1', childId: 'c1' });
      expect(r.get('p1')?.childIds).toContain('c1');
    });

    it('no-op on nonexistent session', () => {
      const r = reduce(emptyRegistry(), { type: 'lock', id: 'missing', reviewerId: 'r' });
      expect(r.size).toBe(0);
    });
  });

  describe('queries', () => {
    it('isActive returns false for missing session', () => {
      expect(sessionIsActive(emptyRegistry(), 'missing')).toBe(false);
    });

    it('canTransition returns false for missing session', () => {
      expect(canTransition(emptyRegistry(), 'missing', { _tag: 'Activate', task: 'x' })).toBe(false);
    });

    it('taskOf returns undefined for missing session', () => {
      expect(taskOf(emptyRegistry(), 'missing')).toBeUndefined();
    });

    it('stateOf returns undefined for missing session', () => {
      expect(stateOf(emptyRegistry(), 'missing')).toBeUndefined();
    });
  });

  describe('immutability', () => {
    it('reduce returns new map without mutating input', () => {
      const r0 = reduce(emptyRegistry(), { type: 'activate', id: 's1', task: 't' });
      const r1 = reduce(r0, { type: 'deactivate', id: 's1' });
      expect(r0.has('s1')).toBe(true);
      expect(r1.has('s1')).toBe(false);
    });
  });
});