import { describe, expect, it } from "bun:test";
import { formatSyntaxDiagnostics } from "./hook.js";
import type { SyntaxCheckResult } from "../util/types.js";

describe("AOP Syntax Diagnostics Formatter Tests", () => {
  it("should generate standard error output matching precise syntax layout", () => {
    const mockResult: SyntaxCheckResult = {
      ok: true,
      lang: "typescript",
      errors: [
        {
          line: 12,
          column: 5,
          endLine: 12,
          endColumn: 10,
          severity: "error",
          message: "Unexpected keyword",
        },
      ],
    };

    const formatted = formatSyntaxDiagnostics("src/main.ts", mockResult);

    expect(formatted).toContain("[syntax-check]");
    expect(formatted).toContain("1 syntax issue(s) in src/main.ts (typescript):");
    expect(formatted).toContain("  L12:5-12:10 [error] Unexpected keyword");
  });

  it("should return null when there are no errors and includeOk is not set", () => {
    const result: SyntaxCheckResult = { ok: true, lang: "rust", errors: [] };

    expect(formatSyntaxDiagnostics("lib.rs", result)).toBeNull();
  });

  it("should return ok message when includeOk is set and no errors", () => {
    const result: SyntaxCheckResult = { ok: true, lang: "rust", errors: [] };

    const formatted = formatSyntaxDiagnostics("lib.rs", result, { includeOk: true });

    expect(formatted).toBe("[syntax-check] lib.rs: ok (rust)");
  });

  it("should return null when check returns empty errors (language unsupported etc.)", () => {
    const result: SyntaxCheckResult = { ok: true, lang: "", errors: [] };

    expect(formatSyntaxDiagnostics("foo.xyz", result)).toBeNull();
  });

  it("should format multiple errors correctly", () => {
    const result: SyntaxCheckResult = {
      ok: true,
      lang: "python",
      errors: [
        { line: 1, column: 1, endLine: 1, endColumn: 10, severity: "error", message: "E001" },
        { line: 5, column: 3, endLine: 5, endColumn: 8, severity: "warning", message: "E002" },
      ],
    };

    const formatted = formatSyntaxDiagnostics("app.py", result);

    expect(formatted).toContain("2 syntax issue(s) in app.py (python):");
    expect(formatted).toContain("  L1:1-1:10 [error] E001");
    expect(formatted).toContain("  L5:3-5:8 [warning] E002");
  });
});
