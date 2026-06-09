export const DEDUP_MARKER = '[No Change Since Previous Read/Write]';

export interface DedupedOutputResult {
  output: string;
  seenOutputs: readonly string[];
}

export function deduplicateTextOutput(
  seenOutputs: readonly string[],
  output: string,
): DedupedOutputResult {
  const repeatedOutput = seenOutputs.find(
    (seenOutput) =>
      seenOutput.length > 0 &&
      output !== seenOutput &&
      output.includes(seenOutput) &&
      output.length - seenOutput.length > DEDUP_MARKER.length,
  );

  if (repeatedOutput) return { output: DEDUP_MARKER, seenOutputs };
  return { output, seenOutputs: [...seenOutputs, output] };
}

export function createTextOutputDeduper(): (output: string) => string {
  let seenOutputs: readonly string[] = [];

  return (output: string): string => {
    const result = deduplicateTextOutput(seenOutputs, output);
    seenOutputs = result.seenOutputs;
    return result.output;
  };
}
