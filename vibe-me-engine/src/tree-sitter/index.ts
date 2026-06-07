export { checkSyntax } from './checker.js';
export { isFileEditTool, extractFilePath, extractFilePaths, hasSyntaxCheckMarker, formatSyntaxDiagnostics, appendSyntaxDiagnostics, appendSyntaxDiagnosticsToOutput } from './hook.js';
export type { SyntaxDiagnostic as SyntaxError, SyntaxDiagnostic, SyntaxCheckResult } from '../util/types.js';
