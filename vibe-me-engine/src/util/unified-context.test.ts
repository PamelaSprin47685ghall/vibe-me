import { describe, test, expect } from 'bun:test';
import { resolveUnifiedContext, createUnifiedContext } from './unified-context';

describe('UnifiedContext', () => {
  test('resolves sessionID variants', () => {
    expect(resolveUnifiedContext({ 
      sessionID: 'test-1', 
      directory: '/tmp' 
    }).sessionID).toBe('test-1');
    
    expect(resolveUnifiedContext({ 
      sessionId: 'test-2', 
      directory: '/tmp' 
    }).sessionID).toBe('test-2');
    
    expect(resolveUnifiedContext({ 
      session_id: 'test-3', 
      directory: '/tmp' 
    }).sessionID).toBe('test-3');
  });

  test('resolves directory variants', () => {
    expect(resolveUnifiedContext({ 
      sessionID: 'test', 
      directory: '/a' 
    }).directory).toBe('/a');
    
    expect(resolveUnifiedContext({ 
      sessionID: 'test', 
      cwd: '/b' 
    }).directory).toBe('/b');
    
    expect(resolveUnifiedContext({ 
      sessionID: 'test', 
      workspaceDir: '/c' 
    }).directory).toBe('/c');
  });

  test('throws on missing sessionID', () => {
    expect(() => resolveUnifiedContext({ 
      directory: '/tmp' 
    })).toThrow('Missing required context field: sessionID');
  });

  test('throws on missing directory', () => {
    expect(() => resolveUnifiedContext({ 
      sessionID: 'test' 
    })).toThrow('Missing required context field: directory');
  });

  test('createUnifiedContext constructs valid context', () => {
    const ctx = createUnifiedContext('sess-1', '/tmp', {
      parentSessionID: 'parent-1'
    });
    
    expect(ctx.sessionID).toBe('sess-1');
    expect(ctx.directory).toBe('/tmp');
    expect(ctx.parentSessionID).toBe('parent-1');
  });
});
