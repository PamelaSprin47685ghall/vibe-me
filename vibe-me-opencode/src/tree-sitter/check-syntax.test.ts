import { describe, expect, it } from "bun:test";

import { checkSyntax } from "./checker";

describe("checkSyntax return paths", () => {
  it("always returns ok:true even for unsupported language", async () => {
    const result = await checkSyntax("content", "/tmp/file.unknown_ext");
    expect(result.ok).toBe(true);
  });

  it("returns ok:true with empty errors for valid typescript", async () => {
    const result = await checkSyntax("const x: number = 1;\n", "/tmp/test.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
      expect(result.lang).toBeTruthy();
    }
  });

  it("detects python from content when file has no extension", async () => {
    const pyCode = [
      "import os",
      "import sys",
      "",
      "def main():",
      '    print("Hello, World!")',
      "    for i in range(10):",
      "        if i % 2 == 0:",
      "            print(i)",
      "",
      'if __name__ == "__main__":',
      "    main()",
      "",
    ].join("\n");
    const result = await checkSyntax(pyCode, "/tmp/script");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.lang).toBe("python");
  });

  it("detects javascript from content when file has no extension", async () => {
    const jsCode = [
      'const { useState, useEffect } = require("react");',
      "",
      "module.exports = function App() {",
      "  const [count, setCount] = useState(0);",
      "  return count;",
      "};",
      "",
    ].join("\n");
    const result = await checkSyntax(jsCode, "/tmp/myfile");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.lang).toBe("javascript");
  });
});
