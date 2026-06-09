import { Result, ok, err } from '../general.js';

export type Shell = { readonly _tag: 'Shell' };
export type Python = { readonly _tag: 'Python' };
export type JavaScript = { readonly _tag: 'JavaScript' };
export type RunnerLanguage = Shell | Python | JavaScript;

export const shell: Shell = { _tag: 'Shell' };
export const python: Python = { _tag: 'Python' };
export const javascript: JavaScript = { _tag: 'JavaScript' };

export function runnerLanguageFromString(value: string): Result<RunnerLanguage, string> {
  switch (value) {
    case 'shell': return ok(shell);
    case 'python': return ok(python);
    case 'javascript': return ok(javascript);
    default: return err(`Invalid RunnerLanguage: "${value}"`);
  }
}

export function runnerLanguageToString(language: RunnerLanguage): string {
  switch (language._tag) {
    case 'Shell': return 'shell';
    case 'Python': return 'python';
    case 'JavaScript': return 'javascript';
  }
}

export function matchRunnerLanguage<R>(
  language: RunnerLanguage,
  patterns: {
    readonly Shell: (value: Shell) => R;
    readonly Python: (value: Python) => R;
    readonly JavaScript: (value: JavaScript) => R;
  },
): R {
  switch (language._tag) {
    case 'Shell': return patterns.Shell(language);
    case 'Python': return patterns.Python(language);
    case 'JavaScript': return patterns.JavaScript(language);
  }
}
