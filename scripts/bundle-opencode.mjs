#!/usr/bin/env node
/**
 * Extracts the platform-specific opencode binary from npm and places it
 * in resources/bin/ so electron-builder can bundle it with the app.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const binDir = join(root, "resources", "bin");

const platform = process.env.BUILD_PLATFORM || process.platform;
const arch = process.env.BUILD_ARCH || process.arch;

// Map to npm package names
const platformMap = { darwin: "darwin", linux: "linux", win32: "windows" };
const archMap = { arm64: "arm64", x64: "x64" };

const osPart = platformMap[platform];
const archPart = archMap[arch];

if (!osPart || !archPart) {
  console.error(`Unsupported platform/arch: ${platform}/${arch}`);
  process.exit(1);
}

const pkgName = `opencode-${osPart}-${archPart}`;
const binName = platform === "win32" ? "opencode.exe" : "opencode";

console.log(`Bundling opencode for ${osPart}-${archPart}...`);

// Install the platform-specific package to a temp location
const tmpDir = join(root, ".opencode-tmp");
mkdirSync(tmpDir, { recursive: true });

try {
  execSync(`npm pack ${pkgName}@latest --pack-destination="${tmpDir}"`, {
    cwd: tmpDir,
    stdio: "pipe",
  });

  // Extract the tarball
  const tarball = execSync(`ls ${tmpDir}/${pkgName}-*.tgz`, {
    encoding: "utf-8",
  }).trim();

  execSync(`tar xzf "${tarball}" -C "${tmpDir}"`, { stdio: "pipe" });

  // Find the binary inside the extracted package
  const extractedBin = join(tmpDir, "package", "bin", binName);
  if (!existsSync(extractedBin)) {
    console.error(`Binary not found at ${extractedBin}`);
    // Try alternative location
    const altBin = join(tmpDir, "package", binName);
    if (existsSync(altBin)) {
      copyBinary(altBin);
    } else {
      console.error("Could not find opencode binary in package");
      process.exit(1);
    }
  } else {
    copyBinary(extractedBin);
  }
} finally {
  // Cleanup
  execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" });
}

function copyBinary(src) {
  mkdirSync(binDir, { recursive: true });
  const dest = join(binDir, binName);
  copyFileSync(src, dest);
  chmodSync(dest, 0o755);
  console.log(`Bundled opencode binary to ${dest}`);
}
