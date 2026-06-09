import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
  activateReview,
  deactivateReview,
  addChild,
  setPendingReview,
  clearReviewSessions,
} from './session-registry.js';
import type { ReviewResult } from './session-types.js';

describe('Review Session Memory Leak Prevention', () => {
  beforeEach(() => {
    clearReviewSessions();
  });

  afterEach(() => {
    clearReviewSessions();
  });

  it('should clear all resolver references on parent deactivation', () => {
    const parentID = 'parent';
    const childrenIDs: string[] = [];
    
    activateReview(parentID, 'parent task');
    
    for (let i = 0; i < 100; i++) {
      const childID = `child-${i}`;
      childrenIDs.push(childID);
      activateReview(childID, `child task ${i}`);
      addChild(parentID, childID);
    }
    
    const resolversCalled: ReviewResult[] = [];
    for (const childID of childrenIDs) {
      setPendingReview(childID, (result) => resolversCalled.push(result));
    }
    
    deactivateReview(parentID);
    
    expect(resolversCalled.length).toBe(100);
    for (const result of resolversCalled) {
      expect(result.terminated).toBe(true);
    }
  });

  it('should handle deep child hierarchies without stack overflow', () => {
    const depth = 1000;
    const sessionIDs: string[] = [];
    
    for (let i = 0; i < depth; i++) {
      const sessionID = `session-${i}`;
      sessionIDs.push(sessionID);
      activateReview(sessionID, `task ${i}`);
      if (i > 0) {
        addChild(sessionIDs[i - 1]!, sessionID);
      }
    }
    
    const resolversCalled: ReviewResult[] = [];
    for (let i = 1; i < depth; i++) {
      setPendingReview(sessionIDs[i]!, (result) => resolversCalled.push(result));
    }
    
    deactivateReview(sessionIDs[0]!);
    
    expect(resolversCalled.length).toBe(depth - 1);
  });

  it('should not leak memory on rapid create-destroy cycles', () => {
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      const sessionID = `session-${i}`;
      activateReview(sessionID, `task ${i}`);
      setPendingReview(sessionID, () => {});
      deactivateReview(sessionID);
    }
    
    clearReviewSessions();
  });

  it('should clean up orphaned children when parent is deactivated', () => {
    const parentID = 'parent';
    const childID = 'child';
    const grandchildID = 'grandchild';
    
    activateReview(parentID, 'parent task');
    activateReview(childID, 'child task');
    activateReview(grandchildID, 'grandchild task');
    
    addChild(parentID, childID);
    addChild(childID, grandchildID);
    
    const resolvers: ReviewResult[] = [];
    setPendingReview(childID, (result) => resolvers.push(result));
    setPendingReview(grandchildID, (result) => resolvers.push(result));
    
    deactivateReview(parentID);
    
    expect(resolvers.length).toBe(2);
    expect(resolvers[0]?.terminated).toBe(true);
    expect(resolvers[1]?.terminated).toBe(true);
  });
});
