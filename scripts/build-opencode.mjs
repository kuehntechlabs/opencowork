#!/usr/bin/env node
/**
 * Builds the opencode Node bundle from the pinned submodule. Idempotent —
 * skips if dist/node/node.js exists and is newer than the submodule HEAD.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const opencodeDir = join(root, "vendor/opencode/packages/opencode");
const bundle = join(opencodeDir, "dist/node/node.js");

if (!existsSync(join(root, "vendor/opencode/package.json"))) {
  console.error("build-opencode: submodule missing. Run `git submodule update --init --recursive`.");
  process.exit(1);
}

// Skip rebuild if bundle is newer than the submodule's HEAD commit.
if (existsSync(bundle) && process.env.FORCE !== "1") {
  try {
    const headFile = join(root, "vendor/opencode/.git");
    const head = existsSync(headFile) ? statSync(headFile).mtimeMs : 0;
    const bundleMtime = statSync(bundle).mtimeMs;
    if (bundleMtime > head) {
      console.log("build-opencode: bundle up-to-date, skipping. Set FORCE=1 to rebuild.");
      process.exit(0);
    }
  } catch {}
}

const installRes = spawnSync("bun", ["install", "--frozen-lockfile"], {
  cwd: join(root, "vendor/opencode"),
  stdio: "inherit",
});
if (installRes.status !== 0) {
  console.error("build-opencode: bun install failed");
  process.exit(installRes.status ?? 1);
}

const buildRes = spawnSync("bun", ["script/build-node.ts"], {
  cwd: opencodeDir,
  stdio: "inherit",
});
if (buildRes.status !== 0) {
  console.error("build-opencode: bun script/build-node.ts failed");
  process.exit(buildRes.status ?? 1);
}

if (!existsSync(bundle)) {
  console.error(`build-opencode: bundle missing after build at ${bundle}`);
  process.exit(1);
}
console.log(`build-opencode: OK -> ${bundle}`);
