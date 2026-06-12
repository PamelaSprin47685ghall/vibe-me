export interface SyntaxDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: string;
  message: string;
}

export type SyntaxCheckResult =
  | {
      ok: true;
      lang: string;
      errors: SyntaxDiagnostic[];
    }
  | {
      ok: false;
      lang: string;
      reason: string;
    };
