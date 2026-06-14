import { createHash } from 'node:crypto';
import {
  type CapsFileInfo,
  findCapsFiles as defaultFindCapsFiles,
} from 'engine/caps';

const CAPS_USER_PREFIX = 'caps-synth-user-';
const CAPS_ASSISTANT_PREFIX = 'caps-synth-assistant-';

type Message = {
  info: Record<string, unknown>;
  parts: Array<Record<string, unknown>>;
};

type ToolPart = {
  type: 'tool';
  tool: 'read';
  callID: string;
  id: string;
  sessionID: string | undefined;
  messageID: string;
  state: {
    status: 'completed';
    input: { filePath: string };
    output: string;
    title: string;
    metadata: Record<string, unknown>;
    time: { start: number; end: number };
  };
};

export type FindCapsFiles = (projectRoot: string) => Promise<CapsFileInfo[]>;

function formatReadOutput(filePath: string, content: string): string {
  const lines = content.split('\n');
  const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
  return [
    `<path>${filePath}</path>`,
    '<type>file</type>',
    '<content>',
    numbered,
    '',
    `(End of file - total ${lines.length} lines)`,
    '</content>',
  ].join('\n');
}

function stableFingerprint(capsFiles: CapsFileInfo[]): string {
  const hash = createHash('sha256');
  for (const cap of capsFiles) {
    hash.update(cap.filePath);
    hash.update('\0');
    hash.update(cap.content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

function hasExistingCapsMessages(messages: Message[]): boolean {
  return (
    messages.length >= 2 &&
    typeof messages[0].info.id === 'string' &&
    messages[0].info.id.startsWith(CAPS_USER_PREFIX) &&
    typeof messages[1].info.id === 'string' &&
    messages[1].info.id.startsWith(CAPS_ASSISTANT_PREFIX)
  );
}

function buildToolParts(
  capsFiles: CapsFileInfo[],
  fp: string,
  sessionID: string | undefined,
  assistantId: string,
): ToolPart[] {
  return capsFiles.map((cap, index) => ({
    type: 'tool',
    tool: 'read',
    callID: `caps-call-${fp}-${index}`,
    id: `caps-tool-${fp}-${index}`,
    sessionID,
    messageID: assistantId,
    state: {
      status: 'completed',
      input: { filePath: cap.filePath },
      output: formatReadOutput(cap.filePath, cap.content),
      title: `Read ${cap.filePath}`,
      metadata: {},
      time: { start: 0, end: 1 },
    },
  }));
}

function buildUserMessage(
  userId: string,
  sessionID: string | undefined,
): Message {
  return {
    info: {
      id: userId,
      sessionID,
      role: 'user',
      time: { created: 0 },
      agent: 'orchestrator',
      model: { providerID: '', modelID: '' },
    },
    parts: [{ type: 'text', text: '你好' }],
  };
}

function buildAssistantMessage(
  assistantId: string,
  userId: string,
  sessionID: string | undefined,
  projectRoot: string,
  toolParts: ToolPart[],
): Message {
  return {
    info: {
      id: assistantId,
      sessionID,
      role: 'assistant',
      time: { created: 0, completed: 1 },
      parentID: userId,
      modelID: '',
      providerID: '',
      mode: 'code',
      path: { cwd: projectRoot, root: projectRoot },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    },
    parts: toolParts,
  };
}

export function createCapsMessagesInjector(
  projectRoot: string,
  excludedAgents: string[] = [],
  findCapsFiles: FindCapsFiles = defaultFindCapsFiles,
) {
  return {
    async handleMessagesTransform(output: {
      messages: unknown[];
    }): Promise<void> {
      const messages = output.messages as Message[];
      if (messages.length === 0) return;

      if (hasExistingCapsMessages(messages)) messages.splice(0, 2);

      if (
        messages.length > 0 &&
        excludedAgents.includes(messages[0].info.agent as string)
      ) {
        return;
      }

      const capsFiles = await findCapsFiles(projectRoot);
      if (capsFiles.length === 0) return;

      const sessionID = messages[0].info.sessionID as string | undefined;
      const fp = stableFingerprint(capsFiles);
      const userId = `${CAPS_USER_PREFIX}${fp}`;
      const assistantId = `${CAPS_ASSISTANT_PREFIX}${fp}`;
      const toolParts = buildToolParts(capsFiles, fp, sessionID, assistantId);

      messages.unshift(
        buildUserMessage(userId, sessionID),
        buildAssistantMessage(
          assistantId,
          userId,
          sessionID,
          projectRoot,
          toolParts,
        ),
      );
    },
  };
}
