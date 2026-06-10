import { describe, expect, it, beforeEach } from 'bun:test';
import {
  activateReview,
  addChild,
  deactivateReview,
  tryAcquireReviewLock,
  clearReviewSessions,
  setPendingReview,
} from './session-registry.js';
import type { ReviewResult } from './session-node.js';

describe('ReviewSessionNode Aggregate', () => {
  beforeEach(() => {
    clearReviewSessions();
  });

  it('should enforce single aggregate lifecycle', () => {
    const sessionID = 'test-session';
    
    activateReview(sessionID, 'test task');
    expect(tryAcquireReviewLock(sessionID)).toBe(true);
    expect(tryAcquireReviewLock(sessionID)).toBe(false);
  });

  it('should cascade dispose entire tree', () => {
    const rootID = 'root';
    const childIDs = Array.from({ length: 100 }, (_, i) => `child-${i}`);
    
    activateReview(rootID, 'root task');
    for (const childID of childIDs) {
      activateReview(childID, 'child task');
      addChild(rootID, childID);
    }
    
    const resolvers: ReviewResult[] = [];
    for (const childID of childIDs) {
      setPendingReview(childID, (result) => resolvers.push(result));
    }
    
    deactivateReview(rootID);
    
    expect(resolvers.length).toBe(100);
    expect(resolvers.every(r => r.terminated)).toBe(true);
  });

  it('should handle deep tree without stack overflow', () => {
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
    
    const resolvers: ReviewResult[] = [];
    for (let i = 1; i < depth; i++) {
      setPendingReview(sessionIDs[i]!, (result) => resolvers.push(result));
    }
    
    deactivateReview(sessionIDs[0]!);
    
    expect(resolvers.length).toBe(depth - 1);
  });

  it('should prevent state mutation from outside aggregate', () => {
    const sessionID = 'test-session';
    
    activateReview(sessionID, 'test task');
    
    expect(() => {
      activateReview(sessionID, 'another task');
    }).toThrow();
  });
});
