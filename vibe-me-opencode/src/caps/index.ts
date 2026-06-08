import { findCapsFiles, type CapsFileInfo } from 'engine/caps';

const CAPS_USER_PREFIX = 'caps-synth-user-';
const CAPS_ASSISTANT_PREFIX = 'caps-synth-assistant-';

function formatReadOutput(filePath: string, content: string): string {
  const lines = content.split('\n');
  const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
  return `<path>${filePath}</path>\n<type>file</type>\n<content>\n${numbered}\n\n(End of file - total ${lines.length} lines)\n</content>`;
}

function hasExistingCapsMessages(messages: Array<{ info: Record<string, unknown> }>): boolean {
  return (
    messages.length >= 2 &&
    typeof messages[0].info.id === 'string' &&
    (messages[0].info.id as string).startsWith(CAPS_USER_PREFIX) &&
    typeof messages[1].info.id === 'string' &&
    (messages[1].info.id as string).startsWith(CAPS_ASSISTANT_PREFIX)
  );
}

export function createCapsMessagesInjector(
  projectRoot: string,
  excludedAgents: string[] = [],
) {
  return {
    async handleMessagesTransform(output: { messages: unknown[] }): Promise<void> {
      const messages = output.messages as Array<{
        info: Record<string, unknown>;
        parts: Array<Record<string, unknown>>;
      }>;
      if (messages.length === 0) return;

      if (hasExistingCapsMessages(messages)) {
        messages.splice(0, 2);
      }

      if (
        messages.length > 0 &&
        excludedAgents.includes(messages[0].info?.agent as string)
      ) {
        return;
      }

      const capsFiles = await findCapsFiles(projectRoot);
      if (capsFiles.length === 0) return;

      const firstInfo = messages[0].info;
      const sessionID = firstInfo.sessionID as string | undefined;
      const timestamp = Date.now();
      const created = timestamp;
      const completed = timestamp + 1;

      const userId = `${CAPS_USER_PREFIX}${timestamp}`;
      const assistantId = `${CAPS_ASSISTANT_PREFIX}${timestamp}`;

      const toolParts = capsFiles.map((cap, index) => ({
        type: 'tool',
        tool: 'read',
        callID: `caps-call-${timestamp}-${index}`,
        id: `caps-tool-${timestamp}-${index}`,
        sessionID,
        messageID: assistantId,
        state: {
          status: 'completed',
          input: { filePath: cap.filePath },
          output: formatReadOutput(cap.filePath, cap.content),
          title: `Read ${cap.filePath}`,
          metadata: {},
          time: { start: timestamp, end: timestamp + 1 },
        },
      }));

      const userMessage = {
        info: {
          id: userId,
          sessionID,
          role: 'user',
          time: { created },
          agent: 'orchestrator',
          model: { providerID: '', modelID: '' },
        },
        parts: [{ type: 'text', text: '你好' }],
      };

      const assistantMessage = {
        info: {
          id: assistantId,
          sessionID,
          role: 'assistant',
          time: { created, completed },
          parentID: userId,
          modelID: '',
          providerID: '',
          mode: 'code',
          path: { cwd: projectRoot, root: projectRoot },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: toolParts,
      };

      messages.unshift(userMessage, assistantMessage);
    },
  };
}
