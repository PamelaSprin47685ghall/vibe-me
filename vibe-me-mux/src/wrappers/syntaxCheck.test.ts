import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createSyntaxCheckWrappers } from "./syntaxCheck.js";
import type { LoggerLike } from "../types/deps.js";
import type { PluginToolConfiguration } from "../types/tool.js";
import type { ToolLike } from "../types/contract.js";

function createMockLogger() {
  return { debug: mock() } satisfies LoggerLike;
}

function createMockConfig(cwd: string): PluginToolConfiguration {
  return { cwd };
}

function wrapTool(targetTool: string, baseTool: ToolLike, config: PluginToolConfiguration, log: LoggerLike) {
  const wrappers = createSyntaxCheckWrappers(log);
  const entry = wrappers.find((w) => w.targetTool === targetTool);
  if (!entry) throw new Error(`wrapper for ${targetTool} not found`);
  return entry.wrapper(baseTool, config);
}

describe("createSyntaxCheckWrappers", () => {
  test("returns wrappers for the two file edit tools", () => {
    const wrappers = createSyntaxCheckWrappers(createMockLogger());

    expect(wrappers).toHaveLength(2);
    expect(wrappers.map((w) => w.targetTool)).toEqual([
      "file_edit_replace_string",
      "file_edit_insert",
    ]);
  });
});

describe("syntaxCheck wrapper behavior", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "syntax-check-wrapper-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: appends diagnostics to a string result when the edited file has syntax errors", async (targetTool) => {
    const fileName = "broken.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "function f( {", "utf-8");

    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => "edit done",
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ file_path: fileName });

    expect(typeof result).toBe("string");
    expect((result as string).startsWith("edit done\n\n")).toBe(true);
    expect(result as string).toContain("[syntax-check]");
    expect(result as string).toContain(fileName);
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: adds syntax_diagnostics to an object result with success:true when the file has syntax errors", async (targetTool) => {
    const fileName = "broken.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "function f( {", "utf-8");

    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => ({ success: true, foo: 1 }),
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ file_path: fileName });

    expect(typeof result).toBe("object");
    expect(result).toEqual({
      success: true,
      foo: 1,
      syntax_diagnostics: expect.stringContaining("[syntax-check]"),
    });
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: returns the original string result when the file is syntactically valid", async (targetTool) => {
    const fileName = "valid.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "const x: number = 1;", "utf-8");

    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => "edit done",
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ file_path: fileName });

    expect(result).toBe("edit done");
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: returns the original object result unchanged when the file is syntactically valid", async (targetTool) => {
    const fileName = "valid.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "const x: number = 1;", "utf-8");

    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => ({ success: true, foo: 1 }),
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ file_path: fileName });

    expect(result).toEqual({ success: true, foo: 1 });
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: returns the original result when args contain no extractable file path", async (targetTool) => {
    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => "edit done",
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ other: "value" });

    expect(result).toBe("edit done");
  });

  test.each([
    "file_edit_replace_string",
    "file_edit_insert",
  ])("%s: returns the original result unchanged when the file cannot be read", async (targetTool) => {
    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: targetTool,
      execute: () => "edit done",
    };

    const wrapped = wrapTool(targetTool, baseTool, config, log);
    const result = await wrapped.execute!({ file_path: "missing.ts" });

    expect(result).toBe("edit done");
    expect(log.debug).toHaveBeenCalledTimes(0);
  });

  test("handles a synchronous base execute by returning a promise that resolves with appended diagnostics", async () => {
    const fileName = "broken.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "function f( {", "utf-8");

    const log = createMockLogger();
    const config = createMockConfig(tmpDir);
    const baseTool: ToolLike = {
      name: "file_edit_replace_string",
      execute: () => "edit done",
    };

    const wrapped = wrapTool("file_edit_replace_string", baseTool, config, log);
    const maybePromise = wrapped.execute!({ file_path: fileName });

    expect(maybePromise).toBeInstanceOf(Promise);
    expect(await maybePromise).toContain("[syntax-check]");
  });
});
