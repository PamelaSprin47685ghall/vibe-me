export interface SyntaxDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: string;
  message: string;
}

export interface SyntaxCheckResult {
  ok: true;
  lang: string;
  errors: SyntaxDiagnostic[];
}
