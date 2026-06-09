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

describe("edit tool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "syntax-check-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mock.restore();
  });

  it("appends syntax errors to edit tool output", async () => {
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1\n");
    mockCheckSyntax([
      {
        line: 5,
        column: 1,
        endLine: 5,
        endColumn: 2,
        severity: "warning",
        message: "Expected ')'",
      },
    ]);

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited successfully");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "test.ts" } },
      output,
    );

    expect(output.output).toContain("1 syntax issue(s) in test.ts");
    expect(output.output).toContain("L5:1-5:2 [warning] Expected ')'");
    expect(output.output).toContain("[syntax-check]");
  });

  it("appends syntax check failures to edit tool output", async () => {
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1\n");
    spyOn(checkerModule, "checkSyntax").mockResolvedValue({
      ok: false,
      lang: "typescript",
      errors: [],
      reason: "parser returned undefined",
    });

    const hook = createSyntaxCheckHook(createMockCtx(tmpDir));
    const output = createOutput("edited successfully");

    await hook["tool.execute.after"](
      { tool: "edit", sessionID: "s1", args: { path: "test.ts" } },
      output,
    );

    expect(output.output).toContain("[syntax-check]");
    expect(output.output).toContain(
      "Syntax check failed in test.ts (typescript): parser returned undefined",
    );
  });
});
