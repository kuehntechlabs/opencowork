import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  nativeImage,
} from "electron";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import log from "electron-log";
import Store from "electron-store";
import {
  startSidecar,
  stopSidecar,
  getSidecarUrl,
  readOpencodeConfig,
  writeProviderConfig,
  writeMCPConfig,
  removeMCPConfig,
  restartSidecar,
} from "./sidecar";
import { listMCPServers, clearMCPCache } from "./mcp-inspect";
import { createMenu } from "./menu";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0f0f0f",
    icon: join(__dirname, "../../resources/icons/icon.png"),
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  createMenu(mainWindow);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/main/index.html"));
  }
}

// IPC handlers
ipcMain.handle("get-server-url", () => getSidecarUrl());

ipcMain.handle("open-directory-picker", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choose Working Directory",
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});

ipcMain.handle("show-notification", (_event, title: string, body: string) => {
  const { Notification } = require("electron");
  new Notification({ title, body }).show();
});

ipcMain.handle("get-platform", () => process.platform);

ipcMain.handle("read-provider-config", () => readOpencodeConfig());
ipcMain.handle(
  "write-provider-config",
  (_event, providerConfig: Record<string, unknown>) =>
    writeProviderConfig(providerConfig),
);
ipcMain.handle("restart-sidecar", async () => {
  const url = await restartSidecar();
  return url;
});

// Skills management
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

ipcMain.handle("list-installed-skills", async () => {
  try {
    // Check both global and project skills directories
    const dirs = [
      join(homedir(), ".claude", "skills"),
      join(homedir(), ".agents", "skills"),
    ];
    const installed = new Set<string>();
    for (const dir of dirs) {
      if (existsSync(dir)) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            installed.add(entry.name);
          }
        }
      }
    }
    return Array.from(installed);
  } catch {
    return [];
  }
});

ipcMain.handle(
  "install-skill",
  async (_event, source: string, skillName: string) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        [
          "skills",
          "add",
          source,
          "--skill",
          skillName,
          "-g",
          "-y",
          "--agent",
          "claude-code",
        ],
        { timeout: 120_000, env: { ...process.env, FORCE_COLOR: "0" } },
      );
      return { ok: true, output: stdout || stderr };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, output: msg };
    }
  },
);

ipcMain.handle("remove-skill", async (_event, location: string) => {
  try {
    // location is the SKILL.md path — remove its parent directory
    const skillDir = join(location, "..");
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
      return { ok: true, output: "Removed" };
    }
    return { ok: false, output: "Not found" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, output: msg };
  }
});

// Proxy fetch (bypass CORS for renderer)
ipcMain.handle("fetch-url", async (_event, url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status, body: "" };
  const body = await res.text();
  return { ok: true, status: res.status, body };
});

// MCP config
ipcMain.handle(
  "write-mcp-config",
  (_event, mcpConfig: Record<string, unknown>) => writeMCPConfig(mcpConfig),
);
ipcMain.handle("remove-mcp-config", (_event, serverName: string) =>
  removeMCPConfig(serverName),
);

// MCP introspection
ipcMain.handle("list-mcp-servers", () => listMCPServers());
ipcMain.handle("refresh-mcp-servers", () => {
  clearMCPCache();
  return listMCPServers();
});

// Projects
const PROJECTS_DIR = join(homedir(), ".opencowork", "projects");
const appStore = new Store({ name: "opencowork-state" });

ipcMain.handle("list-projects", () => {
  if (!existsSync(PROJECTS_DIR)) return [];
  try {
    const entries = readdirSync(PROJECTS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        const p = join(PROJECTS_DIR, e.name);
        const st = statSync(p);
        return {
          name: e.name,
          path: p,
          hasAgentsMd: existsSync(join(p, "AGENTS.md")),
          createdAt: st.birthtimeMs,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    log.warn("Failed to list projects:", err);
    return [];
  }
});

ipcMain.handle(
  "create-project",
  (
    _event,
    opts: {
      name: string;
      instructions?: string;
      filePaths?: string[];
    },
  ) => {
    const projectDir = join(PROJECTS_DIR, opts.name);
    mkdirSync(projectDir, { recursive: true });
    if (opts.instructions) {
      writeFileSync(join(projectDir, "AGENTS.md"), opts.instructions);
    }
    if (opts.filePaths) {
      for (const src of opts.filePaths) {
        const fileName =
          src.split("/").pop() || src.split("\\").pop() || "file";
        copyFileSync(src, join(projectDir, fileName));
      }
    }
    const st = statSync(projectDir);
    return {
      name: opts.name,
      path: projectDir,
      hasAgentsMd: !!opts.instructions,
      createdAt: st.birthtimeMs,
    };
  },
);

ipcMain.handle("delete-project", (_event, name: string) => {
  const projectDir = join(PROJECTS_DIR, name);
  // Safety: only delete if under PROJECTS_DIR
  if (!projectDir.startsWith(PROJECTS_DIR)) return false;
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true });
  }
  return true;
});

ipcMain.handle("open-file-picker", async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    title: "Add Files",
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle("get-recent-directories", () => {
  return appStore.get("recentDirectories", []) as {
    path: string;
    lastUsed: number;
  }[];
});

ipcMain.handle("add-recent-directory", (_event, dirPath: string) => {
  const recent = (
    appStore.get("recentDirectories", []) as {
      path: string;
      lastUsed: number;
    }[]
  ).filter((r) => r.path !== dirPath);
  recent.unshift({ path: dirPath, lastUsed: Date.now() });
  appStore.set("recentDirectories", recent.slice(0, 10));
});

// Skill directory file listing
ipcMain.handle(
  "list-skill-files",
  (_event, dirPath: string): { name: string; type: "file" | "directory" }[] => {
    try {
      if (!existsSync(dirPath)) return [];
      const entries = readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? ("directory" as const) : ("file" as const),
        }))
        .sort((a, b) => {
          // Directories first, then files
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch (err) {
      log.warn("Failed to list skill files:", err);
      return [];
    }
  },
);

// Read file contents — text or binary (as base64 data URL)
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
]);
const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

ipcMain.handle(
  "read-skill-file",
  (
    _event,
    filePath: string,
  ): { type: "text" | "image"; content: string } | null => {
    try {
      if (!existsSync(filePath)) return null;
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        const data = readFileSync(filePath);
        const mime = MIME_MAP[ext] || "application/octet-stream";
        return {
          type: "image",
          content: `data:${mime};base64,${data.toString("base64")}`,
        };
      }
      // Text file — cap at 500KB to avoid UI freeze
      const stat = statSync(filePath);
      if (stat.size > 512 * 1024) {
        return {
          type: "text",
          content: `[File too large: ${(stat.size / 1024).toFixed(0)} KB]`,
        };
      }
      return { type: "text", content: readFileSync(filePath, "utf-8") };
    } catch (err) {
      log.warn("Failed to read skill file:", err);
      return null;
    }
  },
);

// App lifecycle
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Set dock icon (needed for dev mode on macOS)
    if (process.platform === "darwin" && app.dock) {
      const iconPath = join(__dirname, "../../resources/icons/icon.png");
      if (existsSync(iconPath)) {
        app.dock.setIcon(nativeImage.createFromPath(iconPath));
      }
    }

    try {
      await startSidecar();
    } catch (err) {
      log.error("Failed to start opencode sidecar:", err);
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", async () => {
    await stopSidecar();
  });
}
