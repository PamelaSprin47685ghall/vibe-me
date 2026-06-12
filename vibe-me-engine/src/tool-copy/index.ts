export interface ToolCopy {
  readonly description: string;
  readonly params: Readonly<Record<string, string>>;
}

export const TOOL_COPY = {
  "editor": {
    "description": "Execute code changes from natural-language intents. Each intent in the array spawns its own editor subagent session and runs independently in parallel — pass as many as you can at once so they execute concurrently. IMPORTANT: Do NOT assume the editor agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.",
    "params": {
      "intents": "Array of independent code-change intents, each run in parallel via its own editor subagent session. Include all relevant background, design rationale, file paths, and specific requirements."
    }
  },
  "greper": {
    "description": "Search the codebase from natural-language intents. Each intent in the array spawns its own search subagent session and runs independently in parallel — pass as many as you can at once so they execute concurrently. IMPORTANT: Do NOT assume the search agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in each intent. Failure to do so will cause severe confusion.",
    "params": {
      "intents": "Array of independent code-search intents, each run in parallel via its own search subagent session. Include all relevant background, design rationale, file paths, and specific requirements."
    }
  },
  "reverie": {
    "description": "Receive a natural-language intent or question for deep reasoning and delegate to the reverie agent. IMPORTANT: Do NOT assume the reverie agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent and files. Failure to do so will cause severe confusion.",
    "params": {
      "intent": "A natural-language intent or question to contemplate. Must include all relevant background, design rationale, and specific requirements. Do not assume the agent knows anything about the project context.",
      "files": "File paths to provide as context. Include any design docs, relevant code, or background material the agent needs to understand the question."
    }
  },
  "browser": {
    "description": "Receive a natural-language intent for a web task and delegate to the browser agent. IMPORTANT: Do NOT assume the browser agent knows the project background, design documents, or any specific domain knowledge. You must provide all necessary context explicitly in your intent. Failure to do so will cause severe confusion.",
    "params": {
      "intent": "A natural-language intent describing the desired web task. Must include all relevant background, design rationale, URLs, and specific requirements. Do not assume the agent knows anything about the project context."
    }
  },
  "executor": {
    "description": "Executes a shell command, Python code, or JavaScript/TypeScript program synchronously with a strict timeout budget. On completion (or timeout) the captured output is either returned directly or, when it exceeds 8192 bytes, summarized by a tightly-scoped sub-agent. IMPORTANT: If executing Python (language=\"python\") or JavaScript (language=\"javascript\") code, you must specify all necessary third-party package dependencies (e.g. numpy, pandas, requests for Python; lodash, axios for JavaScript) in the \"dependencies\" argument so they can be installed and resolved before execution.",
    "params": {
      "language": "Execution language: shell, python, or javascript",
      "program": "The program to execute. Can be a shell command, Python code, or JavaScript/TypeScript code depending on language.",
      "dependencies": "Dependencies to install (for python or javascript language). Explicitly specify all third-party libraries used in the code so they can be resolved before execution.",
      "timeout_type": "Execution timeout budget. 'short' (1s) for fast local operations, 'long' (10s) for network-bound tasks."
    }
  },
  "websearch": {
    "description": "Search the web for any topic and get clean, ready-to-use content.\n\nBest for: Finding current information, news, facts, people, companies, or answering questions about any topic.\nReturns: Clean text content from top search results.\n\nQuery tips:\ndescribe the ideal page, not keywords. \"blog post comparing React and Vue performance\" not \"React vs Vue\".\nUse category:people / category:company to search through Linkedin profiles / companies respectively.",
    "params": {
      "query": "Natural language search query. Should be a semantically rich description of the ideal page, not just keywords.",
      "numResults": "Number of search results to return (default: 10)"
    }
  },
  "webfetch": {
    "description": "Fetch a URL with better extraction for static/docs pages. Supports llms.txt probing, content-focused HTML extraction, metadata, redirects, and an optional prompt processed by a cheap secondary model.",
    "params": {
      "url": "The URL to fetch",
      "extract_main": "Extract main content from the page, removing navigation, ads, etc. (default: true)",
      "prefer_llms_txt": "Probe for llms.txt files before fetching full page (default: auto)",
      "prompt": "Optional extraction task to run on the fetched content using a cheap secondary model",
      "timeout": "Timeout in seconds (max: 120)"
    }
  },
  "fuzzy_find": {
    "description": "Search for files by fuzzy path text matching. Returns file paths ranked by relevance and frecency. Supports partial matches on file names and directory paths. Regex and glob syntax are not supported.\n\nFirst call: provide pattern and optional path.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    "params": {
      "pattern": "Initial plain fuzzy file path text to search for (e.g., 'component', 'src/utils/', 'Button.tsx'). Regex and glob syntax are not supported.",
      "path": "Initial optional path constraint to narrow search scope",
      "limit": "Maximum number of results to return per call (default: 30)",
      "iterator": "Opaque single-use iterator from a previous fuzzy_find result. On continuation, pass only this field. Iteration is finished when the result shows iterator=\"\"."
    }
  },
  "fuzzy_grep": {
    "description": "Search file contents using fuzzy-aware content search. Smart-case, git-aware, frecency-ranked. Supports automatic regex mode for regex-like patterns and automatic fuzzy fallback when no exact matches are found.\n\nFirst call: provide pattern and optional filters.\nLater calls: provide only iterator.\nEvery result ends with iterator=\"...\"; iteration is finished when it becomes iterator=\"\".",
    "params": {
      "pattern": "Initial search pattern. Required on the first call. Supports literal text and regex-like patterns.",
      "path": "Initial path constraint (repo-relative or absolute path outside workspace). Use 'src/' or '*.ts' to narrow the first call.",
      "exclude": "Initial exclude paths (e.g. 'test/,*.min.js')",
      "caseSensitive": "Initial case-sensitivity override (smart-case by default - case-insensitive when pattern is all lowercase)",
      "context": "Initial number of context lines before and after each match",
      "limit": "Maximum number of matches to return per call",
      "iterator": "Opaque single-use iterator from a previous fuzzy_grep result. On continuation, pass only this field. Iteration is finished when the result shows iterator=\"\"."
    }
  }
} as const satisfies Record<string, ToolCopy>;
