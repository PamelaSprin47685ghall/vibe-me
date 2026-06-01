export interface GeneratedWorkspaceName {
  name: string;
  title: string;
}

const ENGLISH_WORD_PATTERN = /[a-zA-Z]+/g;
const RANDOM_HEX_LENGTH = 4;
const MAX_WORKSPACE_NAME_LENGTH = 64;

function generateRandomHexSuffix(): string {
  const bytes = new Uint8Array(RANDOM_HEX_LENGTH / 2);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getLongestEnglishWord(message: string): string | null {
  const matches = message.match(ENGLISH_WORD_PATTERN);
  if (!matches || matches.length === 0) {
    return null;
  }

  let longestWord = matches[0].toLowerCase();
  for (const match of matches) {
    const normalizedWord = match.toLowerCase();
    if (normalizedWord.length > longestWord.length) {
      longestWord = normalizedWord;
    }
  }

  return longestWord;
}

export function generateWorkspaceNameFromMessage(message: string): GeneratedWorkspaceName {
  const randomHexSuffix = generateRandomHexSuffix();
  const longestEnglishWord = getLongestEnglishWord(message);

  if (!longestEnglishWord) {
    return { name: randomHexSuffix, title: randomHexSuffix };
  }

  const maxBaseLength = MAX_WORKSPACE_NAME_LENGTH - RANDOM_HEX_LENGTH - 1;
  const baseName = longestEnglishWord.slice(0, maxBaseLength);
  const generatedName = `${baseName}-${randomHexSuffix}`;
  return { name: generatedName, title: generatedName };
}
