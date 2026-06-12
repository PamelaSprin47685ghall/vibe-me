import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readAndCheckSyntax, SYNTAX_CHECK_MARKER } from "./hook.js";

describe("readAndCheckSyntax", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-and-check-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns formatted diagnostics for a file with syntax errors", async () => {
    const fileName = "broken.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "function f( {", "utf-8");

    const result = await readAndCheckSyntax(fileName, tmpDir);

    expect(result).not.toBeNull();
    expect(result).toContain(SYNTAX_CHECK_MARKER);
    expect(result).toContain("syntax issue(s) in broken.ts");
  });

  it("returns null for a syntactically valid file", async () => {
    const fileName = "valid.ts";
    await fs.writeFile(path.join(tmpDir, fileName), "const x: number = 1;", "utf-8");

    const result = await readAndCheckSyntax(fileName, tmpDir);

    expect(result).toBeNull();
  });

  it("returns null when the file does not exist", async () => {
    const result = await readAndCheckSyntax("missing-file.ts", tmpDir);

    expect(result).toBeNull();
  });

  it("returns null for an unsupported file extension", async () => {
    const fileName = "notes.xyz";
    await fs.writeFile(path.join(tmpDir, fileName), "any content", "utf-8");

    const result = await readAndCheckSyntax(fileName, tmpDir);

    expect(result).toBeNull();
  });
});
