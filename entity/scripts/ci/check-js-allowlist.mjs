#!/usr/bin/env node

import { readdirSync, statSync } from "fs";
import { extname, join, relative } from "path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "scripts", "tests", "dashboard/src"];
const ALLOWED_JS = new Set([]);
const JS_EXTENSIONS = new Set([".js", ".jsx"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (JS_EXTENSIONS.has(extname(fullPath))) {
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
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    if (!ALLOWED_JS.has(rel)) {
      violations.push(rel);
    }
  }
}

if (violations.length > 0) {
  console.error("JS allowlist check failed. Non-shim JS/JSX files found:");
  for (const rel of violations.sort()) {
    console.error(`  - ${rel}`);
  }
  process.exit(1);
}

console.log("JS allowlist check passed.");
