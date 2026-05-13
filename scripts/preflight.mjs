#!/usr/bin/env node
/**
 * Build-time preflight: verifies Bun is on PATH. Without it the opencode Node
 * bundle cannot be produced. Prints install hints and exits non-zero on miss.
 */
import { execFileSync } from "node:child_process";

try {
  const v = execFileSync("bun", ["--version"], { encoding: "utf-8" }).trim();
  console.log(`preflight: bun ${v} OK`);
} catch {
  console.error("preflight: bun not found on PATH.");
  console.error("Install Bun: https://bun.sh/docs/installation");
  console.error("  macOS:  brew install oven-sh/bun/bun");
  console.error("  Linux:  curl -fsSL https://bun.sh/install | bash");
  console.error("  Windows: powershell -c \"irm bun.sh/install.ps1 | iex\"");
  process.exit(1);
}
