import { createTextOutputDeduper } from 'engine/util';

export function createToolOutputDeduper() {
  return {
    async handleMessagesTransform(output: { messages: unknown[] }): Promise<void> {
      const messages = output.messages as Array<{
        info: Record<string, unknown>;
        parts: Array<Record<string, unknown>>;
      }>;
      if (messages.length === 0) return;

      const dedupeOutput = createTextOutputDeduper();

      for (const msg of messages) {
        for (const part of msg.parts) {
          if (part.type !== 'tool' || part.tool !== 'read') continue;
          const state = part.state as Record<string, unknown> | undefined;
          if (!state) continue;
          const outputText = state.output;
          if (typeof outputText !== 'string') continue;

          const output = dedupeOutput(outputText);
          if (output !== outputText) state.output = output;
        }
      }
    },
  };
}
