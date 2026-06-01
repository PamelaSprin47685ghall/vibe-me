export interface SyntaxDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: string;
  message: string;
}

export interface SyntaxCheckOk {
  ok: true;
  lang: string;
  errors: SyntaxDiagnostic[];
}

export interface SyntaxCheckFail {
  ok: false;
  reason: string;
}

export type SyntaxCheckResult = SyntaxCheckOk | SyntaxCheckFail;
