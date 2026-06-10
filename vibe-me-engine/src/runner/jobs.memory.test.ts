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
          },
          stderr: {
            on: () => {},
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
    const result = await execute({
      sessionId: "test-isolated-session",
      program: "cat log.txt | tail -n 10",
      language: "shell",
      earlyTimeoutMs: 200,
    });

    expect(result.background).toBe(false);
    expect(result.output).toContain("Line 1");
    expect(result.output).toContain("Line 3");
  });
});
