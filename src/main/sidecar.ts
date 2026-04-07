import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import log from "electron-log";
import treeKill from "tree-kill";

export interface SidecarInfo {
  url: string;
  process: ChildProcess;
}

let sidecar: SidecarInfo | null = null;

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

/** Try to kill any existing process on the given port */
function killProcessOnPort(port: number): void {
  try {
    const pid = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (pid) {
      log.info(`Killing existing process ${pid} on port ${port}`);
      process.kill(parseInt(pid, 10), "SIGTERM");
    }
  } catch {
    // No process on port, that's fine
  }
}

/** Find a free port starting from the preferred one */
function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, "127.0.0.1", () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", () => {
      // Port busy, try next
      const server2 = createServer();
      server2.listen(0, "127.0.0.1", () => {
        const addr = server2.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        server2.close(() => resolve(port));
      });
    });
  });
}

export async function startSidecar(port = 4096): Promise<SidecarInfo> {
  if (sidecar) return sidecar;

  ensureOpencodeConfig();

  // Try to free the preferred port first
  killProcessOnPort(port);
  // Short wait for the port to be released
  await new Promise((r) => setTimeout(r, 300));

  const actualPort = await findFreePort(port);
  const args = ["serve", `--hostname=127.0.0.1`, `--port=${actualPort}`];

  log.info(`Starting opencode sidecar on port ${actualPort}...`);

  const proc = spawn("opencode", args, {
    env: {
      ...process.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for opencode server to start (10s)"));
    }, 10000);

    let output = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.includes("opencode server listening")) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (match) {
            clearTimeout(timeout);
            resolve(match[1]!);
            return;
          }
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      log.warn("opencode stderr:", chunk.toString());
    });

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`opencode exited with code ${code}\n${output}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  log.info(`opencode sidecar ready at ${url}`);
  sidecar = { url, process: proc };
  return sidecar;
}

export function stopSidecar(): Promise<void> {
  return new Promise((resolve) => {
    if (!sidecar) {
      resolve();
      return;
    }

    const pid = sidecar.process.pid;
    sidecar = null;

    if (pid) {
      treeKill(pid, "SIGTERM", (err) => {
        if (err) log.warn("Error killing sidecar:", err);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getSidecarUrl(): string | null {
  return sidecar?.url ?? null;
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

export async function restartSidecar(): Promise<string | null> {
  await stopSidecar();
  try {
    const info = await startSidecar();
    return info.url;
  } catch (err) {
    log.error("Failed to restart sidecar:", err);
    return null;
  }
}
