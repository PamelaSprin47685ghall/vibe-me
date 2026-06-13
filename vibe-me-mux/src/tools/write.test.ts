import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createWriteTool } from "./write.js";
import type { PluginToolConfiguration } from "../types/tool.js";

describe("createWriteTool", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-tool-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("writes a syntactically valid file and returns a success message without diagnostics", async () => {
    const config: PluginToolConfiguration = { cwd: tmpDir };
    const tool = createWriteTool({} as never);
    const file_path = "valid.ts";
    const content = "const x: number = 1;";

    const result = await tool.execute(config, { file_path, content });

    const resolved = path.resolve(tmpDir, file_path);
    expect(result).toBe(`Successfully wrote to ${resolved}`);

    const written = await fs.readFile(resolved, "utf-8");
    expect(written).toBe(content);
  });

  test("writes a file with syntax errors and appends diagnostics to the success message", async () => {
    const config: PluginToolConfiguration = { cwd: tmpDir };
    const tool = createWriteTool({} as never);
    const file_path = "broken.ts";
    const content = "function f( {";

    const result = await tool.execute(config, { file_path, content });

    expect(result).toContain("Successfully wrote to");
    expect(result).toContain("[syntax-check]");

    const resolved = path.resolve(tmpDir, file_path);
    const written = await fs.readFile(resolved, "utf-8");
    expect(written).toBe(content);
  });

  test("creates missing parent directories when writing a nested file", async () => {
    const config: PluginToolConfiguration = { cwd: tmpDir };
    const tool = createWriteTool({} as never);
    const file_path = "newsub/a.ts";
    const content = "const x: number = 1;";

    const result = await tool.execute(config, { file_path, content });

    const resolved = path.resolve(tmpDir, file_path);
    expect(result).toBe(`Successfully wrote to ${resolved}`);

    const written = await fs.readFile(resolved, "utf-8");
    expect(written).toBe(content);
  });
});
