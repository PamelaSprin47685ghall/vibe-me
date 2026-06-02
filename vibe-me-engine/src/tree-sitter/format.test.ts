import { describe, expect, it } from "bun:test";
import { formatSyntaxDiagnostics, SYNTAX_CHECK_MARKER } from "./hook.js";
import type { SyntaxCheckResult } from "../util/types.js";

describe("Aspect Output Normalization", () => {
  it("should format single error with precise layout", () => {
    const mockResult: SyntaxCheckResult = {
      ok: true,
      lang: "rust",
      errors: [
        {
          line: 45,
          column: 8,
          endLine: 45,
          endColumn: 12,
          severity: "error",
          message: 'expected `;`, found `}`',
        },
      ],
    };

    const formatted = formatSyntaxDiagnostics("src/main.rs", mockResult);

    expect(formatted).toContain(SYNTAX_CHECK_MARKER);
    expect(formatted).toContain("1 syntax issue(s) in src/main.rs (rust):");
    expect(formatted).toContain("  L45:8-45:12 [error] expected `;`, found `}`");
  });

  it("should format multiple errors consistently", () => {
    const mockResult: SyntaxCheckResult = {
      ok: true,
      lang: "typescript",
      errors: [
        {
          line: 10,
          column: 5,
          endLine: 10,
          endColumn: 8,
          severity: "error",
          message: "unexpected token",
        },
        {
          line: 20,
          column: 1,
          endLine: 20,
          endColumn: 10,
          severity: "error",
          message: "missing closing brace",
        },
      ],
    };

    const formatted = formatSyntaxDiagnostics("src/index.ts", mockResult);

    expect(formatted).toContain(SYNTAX_CHECK_MARKER);
    expect(formatted).toContain("2 syntax issue(s) in src/index.ts (typescript):");
    expect(formatted).toContain("  L10:5-10:8 [error] unexpected token");
    expect(formatted).toContain("  L20:1-20:10 [error] missing closing brace");
  });

  it("should return null for clean files by default", () => {
    const mockResult: SyntaxCheckResult = {
      ok: true,
      lang: "python",
      errors: [],
    };

    const formatted = formatSyntaxDiagnostics("src/app.py", mockResult);
    expect(formatted).toBeNull();
  });

  it("should format clean files when includeOk is enabled", () => {
    const mockResult: SyntaxCheckResult = {
      ok: true,
      lang: "javascript",
      errors: [],
    };

    const formatted = formatSyntaxDiagnostics("src/utils.js", mockResult, {
      includeOk: true,
    });

    expect(formatted).toBe(
      `${SYNTAX_CHECK_MARKER} src/utils.js: ok (javascript)`
    );
  });

  it("should return null for failed check results", () => {
    const mockResult: SyntaxCheckResult = {
      ok: false,
      reason: "unsupported language",
    };

    const formatted = formatSyntaxDiagnostics("README.md", mockResult);
    expect(formatted).toBeNull();
  });

  it("should maintain consistent marker across all outputs", () => {
    const results = [
      {
        ok: true as const,
        lang: "go",
        errors: [
          {
            line: 5,
            column: 1,
            endLine: 5,
            endColumn: 5,
            severity: "error" as const,
            message: "syntax error",
          },
        ],
      },
      {
        ok: true as const,
        lang: "cpp",
        errors: [],
      },
    ];

    const formatted1 = formatSyntaxDiagnostics("main.go", results[0]!);
    const formatted2 = formatSyntaxDiagnostics("main.cpp", results[1]!, {
      includeOk: true,
    });

    expect(formatted1).toContain(SYNTAX_CHECK_MARKER);
    expect(formatted2).toContain(SYNTAX_CHECK_MARKER);
    expect(SYNTAX_CHECK_MARKER).toBe("[syntax-check]");
  });
});
