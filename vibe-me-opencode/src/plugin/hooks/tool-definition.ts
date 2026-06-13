import { parseToolID } from 'engine';
import type { ToolDefinitionInput } from './types.js';

export function stripUiParameter(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const properties = parameters.properties;
  if (!properties || typeof properties !== 'object') return parameters;

  const nextProperties = { ...properties } as Record<string, unknown>;
  delete nextProperties._ui;

  const required = parameters.required;
  const nextRequired = Array.isArray(required)
    ? required.filter((key) => key !== '_ui')
    : required;

  return { ...parameters, properties: nextProperties, required: nextRequired };
}

export function shouldStripUiParameter(input: ToolDefinitionInput): boolean {
  const toolId = parseToolID(input.toolID);
  if (toolId._tag === 'Err') return false;
  return input.toolID === 'editor' || input.toolID === 'greper';
}
