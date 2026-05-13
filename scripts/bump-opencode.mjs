#!/usr/bin/env node
/**
 * Bumps the vendor/opencode submodule pin. Default: latest stable v* tag.
 * Pass a tag argument to pin to a specific one (e.g. `npm run bump:opencode -- v1.14.50`).
 * After checkout, runs build + smoke and prints diff of node.ts exports.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const submodule = join(root, "vendor/opencode");

const git = (args, opts = {}) =>
  execFileSync("git", args, { cwd: submodule, encoding: "utf-8", ...opts }).trim();

if (!existsSync(join(submodule, ".git")) && !existsSync(join(submodule, "package.json"))) {
  console.error("bump-opencode: submodule not initialized");
  process.exit(1);
}

const requested = process.argv[2];
let target = requested;
if (!target) {
  git(["fetch", "--tags", "--quiet"]);
  const tags = git([
    "for-each-ref",
    "--sort=-creatordate",
    "--format=%(refname:short)",
    "refs/tags",
  ]).split("\n");
  target = tags.find((t) => /^v\d+\.\d+\.\d+$/.test(t));
  if (!target) {
    console.error("bump-opencode: no v* tag found");
    process.exit(1);
  }
  console.log(`bump-opencode: latest stable tag is ${target}`);
}

const current = git(["describe", "--tags", "--exact-match"]).catch?.(() => null) ?? null;
if (current === target) {
  console.log(`bump-opencode: already at ${target}, nothing to do`);
  process.exit(0);
}

const exportsBefore = readNodeExports();

git(["checkout", target]);
console.log(`bump-opencode: checked out ${target}`);

const build = spawnSync("node", [join(root, "scripts/build-opencode.mjs")], {
  stdio: "inherit",
  env: { ...process.env, FORCE: "1" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const exportsAfter = readNodeExports();
const removed = exportsBefore.filter((e) => !exportsAfter.includes(e));
const added = exportsAfter.filter((e) => !exportsBefore.includes(e));
if (added.length || removed.length) {
  console.log("\nnode.ts exports diff:");
  for (const e of removed) console.log(`  - ${e}`);
  for (const e of added) console.log(`  + ${e}`);
  console.log();
}

const smoke = spawnSync("node", [join(root, "scripts/smoke-opencode.mjs")], { stdio: "inherit" });
if (smoke.status !== 0) {
  console.error("bump-opencode: smoke FAILED — review or revert");
  process.exit(smoke.status ?? 1);
}
console.log(`bump-opencode: ${target} OK`);

function readNodeExports() {
  const f = join(submodule, "packages/opencode/src/node.ts");
  if (!existsSync(f)) return [];
  const src = readFileSync(f, "utf-8");
  const names = [];
  for (const m of src.matchAll(/export\s+(?:\*\s+as\s+(\w+)|\{[^}]*\}|(?:const|function|class|let|var)\s+(\w+))/g)) {
    if (m[1]) names.push(m[1]);
    else if (m[2]) names.push(m[2]);
  }
  for (const m of src.matchAll(/export\s+\{([^}]+)\}/g)) {
    for (const n of m[1].split(",")) names.push(n.trim().split(/\s+as\s+/).pop().trim());
  }
  return [...new Set(names)].sort();
}
