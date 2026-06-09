import { describe, expect, test } from "bun:test";
import { createRegistration } from "./index.js";

const mockDependencies = {
  log: { debug: () => undefined },
  loadConfigOrDefault: () => ({ projects: new Map() }),
  readAgentDefinition: () => Promise.reject(new Error("not used")),
  resolveAgentFrontmatter: () => Promise.reject(new Error("not used")),
  resolveAgentInheritanceChain: () => Promise.resolve([]),
  findWorkspaceEntry: () => undefined,
} as const;

describe("createRegistration", () => {
  test("keeps toolNames aligned with registered tools", () => {
    const registration = createRegistration(mockDependencies as never);

    expect(registration.toolNames).toEqual(registration.tools.map((tool) => tool.name));
    expect(registration.toolNames).toEqual([
      "editor",
      "greper",
      "reverie",
      "runner",
      "runner_wait",
      "runner_abort",
      "browser",
      "submit_review",
      "websearch",
      "webfetch",
      "fuzzy_grep",
      "fuzzy_find",
      "write",
      "start_review_loop",
      "read",
    ]);
  });

  test("registers stealth browser MCP", () => {
    const registration = createRegistration(mockDependencies as never);

    expect(registration.mcpServers["stealth-browser-mcp"]).toContain(
      "git+https://github.com/vibheksoni/stealth-browser-mcp.git@"
    );
  });

  test("emits explicit JSON Schema parameters for web_fetch", () => {
    const registration = createRegistration(mockDependencies as never);
    const webFetchTool = registration.tools.find((tool) => tool.name === "webfetch");

    expect(webFetchTool?.parameters).toEqual({
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        extract_main: {
          type: "boolean",
          description:
            "Extract main content from the page, removing navigation, ads, etc. (default: true)",
        },
        prefer_llms_txt: {
          type: "string",
          enum: ["auto", "always", "never"],
          description: "Probe for llms.txt files before fetching full page (default: auto)",
        },
        prompt: {
          type: "string",
          description:
            "Optional extraction task to run on the fetched content using a cheap secondary model",
        },
        timeout: { type: "number", description: "Timeout in seconds (max: 120)" },
      },
      required: ["url"],
      additionalProperties: false,
    });
  });

  test("registers /loop and /loop-review slash command descriptors", () => {
    const registration = createRegistration(mockDependencies as never);
    const loop = registration.slashCommands.find((c) => c.key === "loop");
    expect(loop).toBeDefined();
    expect(loop?.description).toBeTruthy();
    const loopReview = registration.slashCommands.find((c) => c.key === "loop-review");
    expect(loopReview).toBeDefined();
    expect(loopReview?.description).toBeTruthy();
  });

  test("web overrides keep explicit object parameters", () => {
    const registration = createRegistration(mockDependencies as never);
    const webFetchWrapper = registration.wrappers.find(
      (wrapper) => wrapper.targetTool === "web_fetch"
    );

    const wrappedTool = webFetchWrapper?.wrapper({ name: "web_fetch" } as never, {
      cwd: "/repo",
      runtime: null,
    } as never);

    expect(wrappedTool?.parameters).toEqual({
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        extract_main: {
          type: "boolean",
          description:
            "Extract main content from the page, removing navigation, ads, etc. (default: true)",
        },
        prefer_llms_txt: {
          type: "string",
          enum: ["auto", "always", "never"],
          description: "Probe for llms.txt files before fetching full page (default: auto)",
        },
        prompt: {
          type: "string",
          description:
            "Optional extraction task to run on the fetched content using a cheap secondary model",
        },
        timeout: { type: "number", description: "Timeout in seconds (max: 120)" },
      },
      required: ["url"],
      additionalProperties: false,
    });
  });
});
