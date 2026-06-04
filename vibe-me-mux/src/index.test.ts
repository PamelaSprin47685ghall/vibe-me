import { describe, expect, test } from "bun:test";
import { createRegistration } from "./index.js";

const mockDependencies = {
  log: { debug: () => undefined },
  defaultModel: "anthropic:claude-sonnet-4-5",
  loadConfigOrDefault: () => ({ projects: new Map() }),
  readAgentDefinition: () => Promise.reject(new Error("not used")),
  resolveAgentFrontmatter: () => Promise.reject(new Error("not used")),
  resolveAgentInheritanceChain: () => Promise.resolve([]),
  findWorkspaceEntry: () => undefined,
} as const;

describe("createRegistration", () => {
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
