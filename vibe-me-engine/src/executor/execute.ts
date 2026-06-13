import { stripHeadTailPipes } from './no-head-tail.js';
import { runExecutorProgram, type InternalExecuteOptions } from './programs.js';
import { getExecutorProjectDir } from './paths.js';
import {
  EXECUTOR_SUMMARY_THRESHOLD_BYTES,
  EXECUTOR_TIMEOUT_MS,
  type ExecuteOptions,
  type ExecuteResult,
  type ExecutorLanguage,
} from './types.js';
import { EXTENDED_SHELL_READ_COMMANDS } from './read-commands.js';

const READ_ONLY_WARNING = '// 绝对禁止使用 executor 工具仅仅用于查找或者读写文件，请使用专门工具例如 read/greper/editor 代替！';

export type RunProgram = (options: InternalExecuteOptions, timeoutMs: number) => ReturnType<typeof runExecutorProgram>;

export interface ExecuteDeps {
  runProgram: RunProgram;
}

export function formatExecutorSafetyWarning(output: string, program: string, language: ExecutorLanguage): string {
  if (language !== 'shell') return output;
  const firstWord = program.trim().split(/\s+/)[0]?.split('/').pop();
  if (!firstWord || !EXTENDED_SHELL_READ_COMMANDS.has(firstWord)) return output;
  return `${READ_ONLY_WARNING}\n${output}`;
}

function resolveProjectDir(language: ExecutorLanguage, sessionId: string): string | undefined {
  if (language === 'javascript' || language === 'python') return getExecutorProjectDir(sessionId);
  return undefined;
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') throw new TypeError(`executor: ${name} must be a string`);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

export async function execute(
  options: ExecuteOptions,
  sessionId: string,
  deps: ExecuteDeps = { runProgram: runExecutorProgram },
): Promise<ExecuteResult> {
  assertString(sessionId, 'sessionId');
  const { timeoutType, language } = options;
  let { program } = options;
  if (language === 'shell') program = stripHeadTailPipes(program).script;

  const timeoutMs = EXECUTOR_TIMEOUT_MS[timeoutType];
  const cwd = typeof options.cwd === 'string' ? options.cwd : process.cwd();
  const projectDir = resolveProjectDir(language, sessionId);
  const execOpts: InternalExecuteOptions = {
    program,
    language,
    dependencies: options.dependencies,
    cwd,
    projectDir,
    sessionId,
  };

  try {
    const { stdout, stderr, code, timedOut } = await deps.runProgram(execOpts, timeoutMs);
    const output = formatExecutorSafetyWarning(`${stdout}${stderr}`.trim(), options.program, language);
    if (timedOut) {
      const partial = output || '(no output before timeout)';
      const suffix = `\n[executor] Timed out after ${timeoutMs}ms (${timeoutType}). Partial output returned.`;
      return { _tag: 'Truncated', output: `${partial}${suffix}`.trim(), timeoutType };
    }
    if (code !== 0) {
      return { _tag: 'Failed', output: output || `exited with code ${code}` };
    }
    return { _tag: 'Completed', output: output || '(no output)' };
  } catch (error) {
    if (isErrnoException(error)) {
      const executable = language === 'python' ? 'uvx' : language === 'javascript' ? 'npx' : process.platform === 'win32' ? 'powershell.exe' : 'bash';
      return {
        _tag: 'MissingExecutable',
        executable,
        output: `Error: '${executable}' executable not found. Please ensure '${executable}' is installed and available on your PATH.`,
      };
    }
    throw error;
  }
}

export function shouldSummarize(output: string): boolean {
  return Buffer.byteLength(output, 'utf8') > EXECUTOR_SUMMARY_THRESHOLD_BYTES;
}
