import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as checkerModule from "./checker";
import type { SyntaxError } from "./checker";
import { createSyntaxCheckHook } from "./index";
import { createMockCtx, createOutput } from "./test-helpers";

function mockCheckSyntax(errors: SyntaxError[]) {
  spyOn(checkerModule, "checkSyntax").mockResolvedValue({
    ok: true,
    lang: "typescript",
    errors,
  });
}

describe("skip / noop scenarios", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "syntax-check-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("skips when there are no syntax errors", async () => {
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1\n");
    mockCheckSyntax([]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited successfully");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "test.ts" } },
      output,
    );

    expect(output.output).toBe("edited successfully");
  });

  it("skips when checkSyntax returns empty errors (unsupported language)", async () => {
    writeFileSync(join(tmpDir, "binary.bin"), "\x00\x01\x02");
    spyOn(checkerModule, "checkSyntax").mockResolvedValue({
      ok: true,
      lang: "",
      errors: [],
    });

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited successfully");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "binary.bin" } },
      output,
    );

    expect(output.output).toBe("edited successfully");
  });

  it("ignores non-file-edit tools", async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("ok");

    await hook["tool.execute.after"](
      { tool: "bash", sessionID: "s1", args: {} },
      output,
    );

    expect(output.output).toBe("ok");
  });

  it("ignores non-string output", async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = { title: "edit", output: { success: true }, metadata: {} };

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "test.ts" } },
      output as any,
    );

    expect(output.output).toEqual({ success: true });
  });

  it("skips when args has no file path", async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: {} },
      output,
    );

    expect(output.output).toBe("edited");
  });

  it("skips when file is unreadable", async () => {
    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "nonexistent.ts" } },
      output,
    );

    expect(output.output).toBe("edited");
  });

  it("does not duplicate syntax check if marker already present", async () => {
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1\n");
    mockCheckSyntax([
      {
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 2,
        severity: "warning",
        message: "test error",
      },
    ]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited\n[syntax-check]\nalready here");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "test.ts" } },
      output,
    );

    expect(output.output).toBe("edited\n[syntax-check]\nalready here");
  });
});
