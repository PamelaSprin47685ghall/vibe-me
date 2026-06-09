import type { PluginInput } from '@opencode-ai/plugin';
import { type Entry, readAssistantText } from 'engine/session';

export interface TodoItem {
  id: string;
  content: string;
  status: string;
  priority: string;
}

export interface SessionMessage {
  info?: { role?: string };
  parts?: Array<{ type?: string; text?: string }>;
}

export async function extractSessionText(
  client: PluginInput['client'],
  sessionId: string,
  directory?: string,
): Promise<string> {
  const result = await client.session.messages({
    path: { id: sessionId },
    ...(directory ? { query: { directory } } : {}),
  });
  const messages = asMessageArray(result.data);
  const entries: Entry[] = messages.map((m) => ({
    type: 'message',
    message: {
      role: m.info?.role,
      content: (m.parts ?? []) as Array<{ type?: string; text?: string }>,
    },
  }));
  return readAssistantText(entries) ?? '';
}

export function asTodoArray(data: unknown): TodoItem[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is TodoItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as TodoItem).id === 'string' &&
      typeof (item as TodoItem).status === 'string',
  );
}

export function asMessageArray(data: unknown): SessionMessage[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is SessionMessage => typeof item === 'object' && item !== null,
  );
}
