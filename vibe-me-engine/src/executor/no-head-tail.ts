import type { StripResult, StrippedPipe } from './types.js';

const isWhitespace = (char: string): boolean =>
  char === ' ' || char === '\t' || char === '\n' || char === '\r';

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isLetter = (char: string): boolean =>
  (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');

const isTerminator = (char: string): boolean =>
  char === ';' || char === '&' || char === '\n' || char === '#';

function parsePipe(
  script: string,
  index: number,
): { end: number; stripped: StrippedPipe } | undefined {
  const len = script.length;
  let j = index + 1;

  while (j < len && isWhitespace(script.charAt(j))) j++;

  const nameStart = j;
  while (j < len && isLetter(script.charAt(j))) j++;
  const name = script.slice(nameStart, j);
  if (name !== 'head' && name !== 'tail') return undefined;

  if (j >= len || !isWhitespace(script.charAt(j))) return undefined;
  do {
    j++;
  } while (j < len && isWhitespace(script.charAt(j)));

  if (j + 1 < len && script.charAt(j) === '-' && script[j + 1] === 'n') {
    j += 2;
    while (j < len && isWhitespace(script.charAt(j))) j++;
  } else if (j < len && script.charAt(j) === '-') {
    j++;
  }

  if (j >= len || !isDigit(script.charAt(j))) return undefined;

  const countStart = j;
  do {
    j++;
  } while (j < len && isDigit(script.charAt(j)));
  const count = Number.parseInt(script.slice(countStart, j), 10);

  let k = j;
  while (k < len && isWhitespace(script.charAt(k)) && script.charAt(k) !== '\n') k++;
  if (k < len && !isTerminator(script.charAt(k))) return undefined;

  return {
    end: j,
    stripped: {
      pipe: script.slice(index, j).trim(),
      name,
      count,
    },
  };
}

function readSingleQuotedString(
  script: string,
  i: number,
): { slice: string; nextIndex: number } | undefined {
  const end = script.indexOf("'", i + 1);
  if (end === -1) return undefined;
  return { slice: script.slice(i, end + 1), nextIndex: end + 1 };
}

function readDoubleQuotedString(
  script: string,
  i: number,
): { slice: string; nextIndex: number } {
  const len = script.length;
  let j = i + 1;
  while (j < len) {
    if (script[j] === '\\') {
      j += 2;
      continue;
    }
    if (script[j] === '"') break;
    j++;
  }
  const nextIndex = Math.min(j + 1, len);
  return { slice: script.slice(i, nextIndex), nextIndex };
}

function readHashComment(
  script: string,
  i: number,
): { slice: string; nextIndex: number } | undefined {
  const end = script.indexOf('\n', i);
  if (end === -1) return undefined;
  return { slice: script.slice(i, end + 1), nextIndex: end + 1 };
}

function scan(script: string): { script: string; stripped: StrippedPipe[] } {
  const stripped: StrippedPipe[] = [];
  let out = '';
  let i = 0;
  const len = script.length;

  while (i < len) {
    const ch = script.charAt(i);

    if (ch === "'") {
      const token = readSingleQuotedString(script, i);
      if (!token) {
        out += script.slice(i);
        break;
      }
      out += token.slice;
      i = token.nextIndex;
      continue;
    }

    if (ch === '"') {
      const token = readDoubleQuotedString(script, i);
      out += token.slice;
      i = token.nextIndex;
      continue;
    }

    if (ch === '#') {
      const token = readHashComment(script, i);
      if (!token) {
        out += script.slice(i);
        break;
      }
      out += token.slice;
      i = token.nextIndex;
      continue;
    }

    if (ch === '|') {
      const parsed = parsePipe(script, i);
      if (parsed) {
        let start = i;
        while (start > 0 && isWhitespace(script.charAt(start - 1))) start--;
        out = out.slice(0, out.length - (i - start));
        stripped.push(parsed.stripped);
        i = parsed.end;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return { script: out, stripped };
}

export function stripHeadTailPipes(script: string): StripResult {
  const stripped: StrippedPipe[] = [];
  let current = script;

  while (true) {
    const result = scan(current);
    if (result.stripped.length === 0) break;
    current = result.script;
    stripped.unshift(...result.stripped);
  }

  return { script: current, stripped };
}
