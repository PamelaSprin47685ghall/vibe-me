export { checkSyntax } from './checker.js';
export { isFileEditTool, extractFilePath, hasSyntaxCheckMarker, formatSyntaxDiagnostics, appendSyntaxDiagnostics, appendSyntaxDiagnosticsToOutput } from './hook.js';
export type { SyntaxDiagnostic as SyntaxError, SyntaxDiagnostic, SyntaxCheckOk, SyntaxCheckFail, SyntaxCheckResult } from '../util/types.js';
