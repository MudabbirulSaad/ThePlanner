import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { globSync } from "node:fs";

const forbiddenCoreImportPatterns = [
  /from\s+["'][^"']*src\/adapters\//,
  /from\s+["'](?:\.\.\/)+adapters\//,
  /from\s+["'][^"']*(?:cli|filesystem|git|llm|repo-scan|schema)[^"']*["']/,
  /import\s+["'][^"']*(?:src\/adapters\/|(?:\.\.\/)+adapters\/)[^"']*["']/,
  /import\s*\(\s*["'][^"']*(?:src\/adapters\/|(?:\.\.\/)+adapters\/)[^"']*["']\s*\)/
];

function findBoundaryViolations(files: readonly string[]) {
  return files.flatMap((file) => {
    const source = readFileSync(file, "utf8");

    return forbiddenCoreImportPatterns
      .filter((pattern) => pattern.test(source))
      .map((pattern) => `${relative(process.cwd(), file)} matched ${pattern}`);
  });
}

describe("dependency boundaries", () => {
  it("rejects sample core imports from adapters", () => {
    const fixture = resolve("tests/fixtures/boundary/core-imports-adapter.ts");

    expect(findBoundaryViolations([fixture])).toHaveLength(1);
  });

  it("keeps src/core independent from adapters and infrastructure", () => {
    const coreFiles = globSync("src/core/**/*.ts").map((file) => resolve(file));

    expect(findBoundaryViolations(coreFiles)).toEqual([]);
  });
});
