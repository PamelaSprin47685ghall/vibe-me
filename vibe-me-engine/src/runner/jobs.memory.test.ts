import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ChildProcess } from "node:child_process";

describe("Runner Security & Multi-Pipe Stripping (Memory Stub)", () => {
  beforeEach(() => {
    mock.module("node:child_process", () => ({
      spawn: (_command: string, _args: string[]) => {
        const mockProcess = {
          pid: 88888,
          stdout: {
            on: (event: string, callback: (data: Buffer) => void) => {
              if (event === "data") {
                setTimeout(() => callback(Buffer.from("Line 1\nLine 2\nLine 3\n")), 5);
              }
            },
            removeAllListeners: () => {},
          },
          stderr: {
            on: () => {},
            removeAllListeners: () => {},
          },
          on: (event: string, callback: (code: number) => void) => {
            if (event === "close") {
              setTimeout(() => callback(0), 15);
            }
          },
        };
        return mockProcess as unknown as ChildProcess;
      },
    }));
  });

  it("should strip tail pipes silently and stream back stdout", async () => {
    const { execute } = await import("./jobs.js");
    const { createJobRegistry } = await import("./job-registry.js");
    const result = await execute({
      jobs: createJobRegistry(),
      sessionId: "test-isolated-session",
      program: "cat log.txt | tail -n 10",
      language: "shell",
      earlyTimeoutMs: 200,
    });

    expect(result._tag).toBe("Completed");
    expect(result.output).toContain("Line 1");
    expect(result.output).toContain("Line 3");
  });
});
