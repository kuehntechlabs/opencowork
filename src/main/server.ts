/**
 * Host module — runs in the Electron main process.
 *
 * Forks src/main/sidecar.ts as an Electron utility process which loads the
 * opencode Node bundle in-process. Exposes the same public surface that the
 * old src/main/sidecar.ts exported (start/stop/restart/getUrl + config
 * helpers) so callers can migrate by changing only their import path.
 */
import { createServer } from "node:net";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { app, utilityProcess, BrowserWindow } from "electron";
import log from "electron-log";

export interface SidecarInfo {
  url: string;
  password: string;
}

type WorkerMsg =
  | {
      type: "sqlite";
      progress:
        | { type: "InProgress"; value: number }
        | { type: "Done" };
    }
  | { type: "ready"; url: string; port: number }
  | { type: "stopped" }
  | { type: "error"; reason: string; stack?: string };

let child: Electron.UtilityProcess | null = null;
let info: SidecarInfo | null = null;

// ---------------------------------------------------------------------------
// Config-file helpers (verbatim from previous sidecar.ts)
// ---------------------------------------------------------------------------

const configDir = join(homedir(), ".config", "opencode");
const configPath = join(configDir, "config.json");

function ensureOpencodeConfig(): void {
  const desiredConfig = {
    mcp: {
      gitnexus: {
        type: "local" as const,
        command: ["npx", "-y", "gitnexus@latest", "mcp"],
      },
    },
  };

  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      const existing = JSON.parse(raw);

      // Fix gitnexus MCP entry if it exists but has wrong format
      if (existing.mcp?.gitnexus && !existing.mcp.gitnexus.type) {
        existing.mcp.gitnexus = desiredConfig.mcp.gitnexus;
        writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
        log.info("Fixed opencode config: updated gitnexus MCP format");
      }
    } else {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(desiredConfig, null, 2) + "\n");
      log.info("Created opencode config with gitnexus MCP");
    }
  } catch (err) {
    log.warn("Failed to ensure opencode config:", err);
  }
}

export function readOpencodeConfig(): Record<string, unknown> {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    }
  } catch (err) {
    log.warn("Failed to read opencode config:", err);
  }
  return {};
}

export function writeProviderConfig(
  providerConfig: Record<string, unknown>,
): void {
  const existing = readOpencodeConfig();
  existing.provider = providerConfig;
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
  log.info("Updated opencode provider config");
}

export function writeMCPConfig(mcpConfig: Record<string, unknown>): void {
  const existing = readOpencodeConfig();
  existing.mcp = {
    ...((existing.mcp as Record<string, unknown>) || {}),
    ...mcpConfig,
  };
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
  log.info("Updated opencode MCP config");
}

export function removeMCPConfig(serverName: string): void {
  const existing = readOpencodeConfig();
  const mcp = (existing.mcp as Record<string, unknown>) || {};
  delete mcp[serverName];
  existing.mcp = mcp;
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n");
  log.info(`Removed MCP server: ${serverName}`);
}

// ---------------------------------------------------------------------------
// Port + state helpers
// ---------------------------------------------------------------------------

/** Find a free port starting from the preferred one. */
function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, "127.0.0.1", () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", () => {
      const server2 = createServer();
      server2.listen(0, "127.0.0.1", () => {
        const addr = server2.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        server2.close(() => resolve(port));
      });
    });
  });
}

export function getIsolatedStateDir(): string {
  const dir = join(app.getPath("userData"), "opencode-state");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function needsMigrationCheck(stateDir: string): boolean {
  return !existsSync(join(stateDir, "opencode.db"));
}

function resolveBundlePath(): string {
  const rel = "vendor/opencode/packages/opencode/dist/node/node.js";
  const base = app.isPackaged
    ? app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked")
    : app.getAppPath();
  return join(base, rel);
}

function broadcastMigrationProgress(
  progress:
    | { type: "InProgress"; value: number }
    | { type: "Done" },
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send("opencode-migration-progress", progress);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function startSidecar(preferredPort = 4096): Promise<SidecarInfo> {
  if (info) return info;

  ensureOpencodeConfig();

  const port = await findFreePort(preferredPort);
  const password = randomUUID();
  const xdgStateHome = getIsolatedStateDir();
  const needsMigration = needsMigrationCheck(xdgStateHome);
  const bundlePath = resolveBundlePath();

  if (!existsSync(bundlePath)) {
    throw new Error(
      `opencode bundle missing at ${bundlePath} — run npm run build:opencode`,
    );
  }

  log.info(
    `Starting in-process opencode server on port ${port} (bundle: ${bundlePath})`,
  );

  const workerPath = join(__dirname, "sidecar.js");
  const proc = utilityProcess.fork(workerPath, [], {
    serviceName: "opencode server",
    stdio: "pipe",
  });
  child = proc;

  // Forward stdio to electron-log so worker prints land in the main log file.
  proc.stdout?.on("data", (chunk: Buffer) => {
    log.info("[opencode]", chunk.toString().trimEnd());
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    log.warn("[opencode]", chunk.toString().trimEnd());
  });

  return await new Promise<SidecarInfo>((resolve, reject) => {
    let settled = false;
    let timeout: NodeJS.Timeout;

    const armTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        log.error("Timeout waiting for opencode server to start (60s)");
        try {
          proc.kill();
        } catch {
          // ignore
        }
        child = null;
        reject(new Error("Timeout waiting for opencode server to start (60s)"));
      }, 60_000);
    };

    armTimeout();

    proc.on("message", (raw: unknown) => {
      const msg = raw as WorkerMsg;
      if (msg.type === "sqlite") {
        // Reset start timeout while migration is making progress.
        armTimeout();
        broadcastMigrationProgress(msg.progress);
      } else if (msg.type === "ready") {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        info = { url: msg.url, password };
        log.info(`opencode server ready at ${msg.url}`);
        resolve(info);
      } else if (msg.type === "error") {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const err = new Error(msg.reason);
        if (msg.stack) err.stack = msg.stack;
        log.error("opencode worker error:", msg.reason, msg.stack ?? "");
        child = null;
        reject(err);
      }
    });

    proc.on("exit", (code) => {
      log.info(`opencode worker exited (code=${code})`);
      // Notify any open splash to dismiss.
      broadcastMigrationProgress({ type: "Done" });
      const wasRunning = child === proc;
      child = null;
      info = null;
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(
          new Error(`opencode worker exited before ready (code=${code})`),
        );
      } else if (wasRunning) {
        log.warn("opencode worker exited unexpectedly after ready");
      }
    });

    proc.postMessage({
      type: "start",
      bundlePath,
      port,
      password,
      xdgStateHome,
      needsMigration,
    });
  });
}

export function stopSidecar(): Promise<void> {
  return new Promise((resolve) => {
    const proc = child;
    if (!proc) {
      info = null;
      resolve();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      info = null;
      child = null;
      resolve();
    };

    const timeout = setTimeout(() => {
      if (done) return;
      log.warn("opencode worker did not stop in 6s; killing");
      try {
        proc.kill();
      } catch {
        // ignore
      }
      finish();
    }, 6_000);

    proc.on("exit", () => {
      clearTimeout(timeout);
      finish();
    });

    try {
      proc.postMessage({ type: "stop" });
    } catch (err) {
      log.warn("Failed to postMessage stop to opencode worker:", err);
      clearTimeout(timeout);
      try {
        proc.kill();
      } catch {
        // ignore
      }
      finish();
    }
  });
}

export async function restartSidecar(): Promise<string | null> {
  await stopSidecar();
  try {
    const next = await startSidecar();
    return next.url;
  } catch (err) {
    log.error("Failed to restart opencode server:", err);
    return null;
  }
}

export function getSidecarUrl(): string | null {
  return info?.url ?? null;
}

export function getSidecarPassword(): string | null {
  return info?.password ?? null;
}
