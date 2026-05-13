#!/usr/bin/env node
/**
 * Smoke test: launches Electron, forks a utility process that imports the
 * opencode Node bundle, calls Server.listen, hits /health, exits.
 *
 * Doubles as the Phase-0 spike and the bump gate.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bundle = join(
  root,
  "vendor/opencode/packages/opencode/dist/node/node.js",
);
const harness = join(root, "scripts/smoke-opencode-harness.cjs");

if (!existsSync(bundle)) {
  console.error(`Missing bundle: ${bundle}`);
  console.error("Run `npm run build:opencode` first.");
  process.exit(1);
}

const electronBin = join(root, "node_modules/.bin/electron");
if (!existsSync(electronBin)) {
  console.error(`Missing electron binary at ${electronBin}`);
  process.exit(1);
}

const env = { ...process.env, OPENCODE_BUNDLE: bundle, ELECTRON_ENABLE_LOGGING: "1" };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, [harness], {
  env,
  stdio: "inherit",
});

const timer = setTimeout(() => {
  console.error("smoke: timeout (90s)");
  child.kill("SIGKILL");
  process.exit(1);
}, 90_000);

child.on("exit", (code) => {
  clearTimeout(timer);
  process.exit(code ?? 1);
});
