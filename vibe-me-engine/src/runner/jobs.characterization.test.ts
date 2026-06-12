import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ChildProcess } from "node:child_process";

describe("execute() characterization — discriminated union shape", () => {
  beforeEach(() => {
    mock.module("node:child_process", () => ({
      spawn: (_command: string, _args: string[]) => {
        const mockProcess = {
          pid: 99999,
          stdout: {
            on: (event: string, callback: (data: Buffer) => void) => {
              if (event === "data") {
                setTimeout(() => callback(Buffer.from("done-output\n")), 5);
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

  it("sync-completion branch: _tag=Completed, no jobId field", async () => {
    const { execute } = await import("./jobs.js");
    const { createJobRegistry } = await import("./job-registry.js");
    const result = await execute({
      jobs: createJobRegistry(),
      sessionId: "char-test-sync-session",
      program: "echo done-output",
      language: "shell",
      earlyTimeoutMs: 200,
    });

    expect(result._tag).toBe("Completed");
    expect(result.output).toContain("done-output");
    expect("jobId" in result).toBe(false);
  });

  it("background branch: _tag=Backgrounded, jobId=sessionId", async () => {
    mock.restore();
    mock.module("node:child_process", () => ({
      spawn: (_command: string, _args: string[]) => {
        const mockProcess = {
          pid: 77777,
          stdout: {
            on: (event: string, callback: (data: Buffer) => void) => {
              if (event === "data") {
                setTimeout(() => callback(Buffer.from("partial-output\n")), 5);
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
              setTimeout(() => callback(0), 1000);
            }
          },
        };
        return mockProcess as unknown as ChildProcess;
      },
    }));

    const { execute, cleanupJob } = await import("./jobs.js");
    const { createJobRegistry } = await import("./job-registry.js");
    const jobs = createJobRegistry();
    const sessionId = "char-test-bg-session";
    const result = await execute({
      jobs,
      sessionId,
      program: "sleep 999",
      language: "shell",
      earlyTimeoutMs: 20,
    });

    expect(result._tag).toBe("Backgrounded");
    if (result._tag === "Backgrounded") {
      expect(result.jobId).toBe(sessionId);
    }
    expect(result.output).toContain("partial-output");

    cleanupJob(jobs, sessionId);
  });
});