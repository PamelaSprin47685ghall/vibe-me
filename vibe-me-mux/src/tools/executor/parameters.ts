import type { JsonSchema } from '../../types/contract.js';
import { TOOL_COPY } from 'engine/tool-copy';
import { CANONICAL_TOOL_NAMES } from 'engine/agent-policy';

export const parameters: JsonSchema = {
  type: 'object',
  properties: {
    language: {
      type: 'string',
      enum: ['shell', 'python', 'javascript'],
      description: TOOL_COPY.executor.params.language,
    },
    program: {
      type: 'string',
      description: TOOL_COPY.executor.params.program,
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'string',
        description: 'Python dependency package name',
      },
      description: TOOL_COPY.executor.params.dependencies,
    },
    timeout_type: {
      type: 'string',
      enum: ['short', 'long'],
      description: TOOL_COPY.executor.params.timeout_type,
    },
  },
  required: ['language', 'program', 'timeout_type'],
  additionalProperties: false,
};

export const SUMMARIZER_DISABLED_TOOLS: readonly string[] = [
  ...CANONICAL_TOOL_NAMES,
  'read',
  'write',
  'edit',
  'bash',
  'bash_.*',
  'task',
  'task_.*',
  'patch',
  'fetch',
  'fetch_.*',
  'webfetch',
  'webfetch_.*',
  'websearch',
  'websearch_.*',
  'stealth_browser_mcp_.*',
];
