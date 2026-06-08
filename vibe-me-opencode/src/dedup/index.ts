export function createToolOutputDeduper() {
  return {
    async handleMessagesTransform(output: { messages: unknown[] }): Promise<void> {
      const messages = output.messages as Array<{
        info: Record<string, unknown>;
        parts: Array<Record<string, unknown>>;
      }>;
      if (messages.length === 0) return;

      const seenOutputs: string[] = [];

      for (const msg of messages) {
        for (const part of msg.parts) {
          if (part.type !== 'tool' || part.tool !== 'read') continue;
          const state = part.state as Record<string, unknown> | undefined;
          if (!state) continue;
          const outputText = state.output;
          if (typeof outputText !== 'string') continue;

          if (seenOutputs.some(seen => outputText.includes(seen))) {
            state.output = '[No Change Since Previous Read/Write]';
          } else {
            seenOutputs.push(outputText);
          }
        }
      }
    },
  };
}
