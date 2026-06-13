import { describe, expect, it } from 'vitest';
import {
  parseSessionID,
  parseWorkspaceID,
  parseAgentID,
  parseToolID,
  parseCallID,
  parseChildID,
  validateRecord,
} from './boundary.js';

describe('boundary parsers', () => {
  it('accepts non-empty strings', () => {
    expect(parseSessionID('s1')._tag).toBe('Ok');
    expect(parseWorkspaceID('ws1')._tag).toBe('Ok');
    expect(parseAgentID('orchestrator')._tag).toBe('Ok');
    expect(parseToolID('editor')._tag).toBe('Ok');
    expect(parseCallID('c1')._tag).toBe('Ok');
    expect(parseChildID('child-1')._tag).toBe('Ok');
  });

  it('rejects empty or non-string values', () => {
    expect(parseSessionID('')._tag).toBe('Err');
    expect(parseSessionID(123)._tag).toBe('Err');
    expect(parseSessionID(undefined)._tag).toBe('Err');
  });

  it('collects all field errors in validateRecord', () => {
    const result = validateRecord(
      {
        session: parseSessionID,
        workspace: parseWorkspaceID,
      },
      { session: '', workspace: 42 },
    );
    expect(result._tag).toBe('Err');
    if (result._tag === 'Err') {
      expect(result.error.session).toBeDefined();
      expect(result.error.workspace).toBeDefined();
    }
  });

  it('returns parsed values when all fields valid', () => {
    const result = validateRecord(
      {
        session: parseSessionID,
        workspace: parseWorkspaceID,
      },
      { session: 's1', workspace: 'ws1' },
    );
    expect(result._tag).toBe('Ok');
    if (result._tag === 'Ok') {
      expect(result.value.session).toBe('s1');
      expect(result.value.workspace).toBe('ws1');
    }
  });
});
