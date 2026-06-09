import { createTextOutputDeduper } from "engine/util";

interface DynamicToolPart {
  readonly type: "dynamic-tool";
  readonly toolName: string;
  readonly state: string;
  readonly output?: unknown;
  readonly toolCallId: string;
  [key: string]: unknown;
}

interface MuxMessageLike {
  readonly parts?: readonly DynamicToolPart[];
  [key: string]: unknown;
}

export function deduplicateReadOutputs<T extends MuxMessageLike>(
  messages: readonly T[],
): T[] {
  const dedupeOutput = createTextOutputDeduper();
  let mutated = false;

  const result = messages.map((msg) => {
    if (!msg.parts?.length) return msg;

    const newParts: DynamicToolPart[] = [];
    let partMutated = false;

    for (const part of msg.parts) {
      if (
        part.type === "dynamic-tool" &&
        part.toolName === "read" &&
        part.state === "output-available" &&
        typeof part.output === "string"
      ) {
        const current = part.output;
        const output = dedupeOutput(current);

        if (output === current) {
          newParts.push(part as DynamicToolPart);
        } else {
          newParts.push({ ...part, output });
          partMutated = true;
        }
      } else {
        newParts.push(part as DynamicToolPart);
      }
    }

    if (!partMutated) return msg;
    mutated = true;
    return { ...msg, parts: newParts } as T;
  });

  return mutated ? result : [...messages];
}