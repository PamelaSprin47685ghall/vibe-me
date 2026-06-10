const LOOP_FOOTER = [
  "- report: a detailed description of what you did and why",
  "- affectedFiles: list of every file you modified or created",
  "",
  "A reviewer will examine your submission. If accepted, you are done. If rejected, you will receive specific feedback to address.",
];

export function buildLoopMessage(task: string, ...bodyLines: string[]): string {
  return [`Task (loop): ${task}`, "", ...bodyLines, ...LOOP_FOOTER].join("\n");
}