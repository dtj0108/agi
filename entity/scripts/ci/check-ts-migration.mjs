#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join, relative } from "path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "scripts", "tests", "dashboard/src"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (EXTENSIONS.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

const violations = [];
for (const dir of TARGET_DIRS) {
  const absDir = join(ROOT, dir);
  const files = walk(absDir);

  for (const file of files) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((line, index) => {
      if (line.includes("@ts-ignore")) {
        violations.push(`${rel}:${index + 1} uses disallowed @ts-ignore`);
      }

      if (
        line.includes("@ts-expect-error") &&
        !line.includes("TODO(ts-migration):")
      ) {
        violations.push(
          `${rel}:${index + 1} missing TODO(ts-migration): marker on @ts-expect-error`
        );
      }
    });
  }
}

if (violations.length > 0) {
  console.error("TypeScript migration exception check failed:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("TypeScript migration exception check passed.");
