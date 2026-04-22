import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
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
  cpSync,
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
import {
  listMCPServers,
  listMCPServersFast,
  clearMCPCache,
} from "./mcp-inspect";
import { createMenu } from "./menu";
import {
  installPluginFromSource,
  listInstalledPlugins,
  removePlugin,
  type PluginSource,
} from "./plugins";
import {
  addMarketplace,
  listMarketplaces,
  removeMarketplace,
  refreshMarketplace,
  installMarketplacePlugin,
  inspectMarketplacePlugin,
  type MarketplaceSource,
} from "./marketplaces";

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

  // Set Content-Security-Policy in production
  if (!process.env.ELECTRON_RENDERER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https:; font-src 'self' data:;",
          ],
        },
      });
    });
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
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

ipcMain.handle(
  "open-in-file-manager",
  async (
    _event,
    targetPath: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (!targetPath || !existsSync(targetPath)) {
        return { ok: false, error: "Path does not exist" };
      }
      const isDir = statSync(targetPath).isDirectory();
      if (isDir) {
        const err = await shell.openPath(targetPath);
        if (err) return { ok: false, error: err };
        return { ok: true };
      }
      shell.showItemInFolder(targetPath);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, error: msg };
    }
  },
);

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

async function syncOllamaModelsToConfig(): Promise<{
  synced: boolean;
  models: string[];
  changed: boolean;
}> {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) return { synced: false, models: [], changed: false };
    const data = (await res.json()) as {
      models?: { name: string; size: number }[];
    };
    const ollamaModels = (data.models ?? []).map((m) => m.name);

    const config = readOpencodeConfig();
    const providers = (config.provider ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const ollama = providers.ollama;
    if (!ollama) {
      return { synced: true, models: ollamaModels, changed: false };
    }

    const existing = Object.keys(
      (ollama.models ?? {}) as Record<string, unknown>,
    ).sort();
    const next = [...ollamaModels].sort();
    const changed =
      existing.length !== next.length || existing.some((n, i) => n !== next[i]);

    if (changed) {
      const models: Record<string, { name: string }> = {};
      for (const name of ollamaModels) {
        models[name] = { name };
      }
      ollama.models = models;
      writeProviderConfig(providers);
      log.info(`Synced ${ollamaModels.length} Ollama models to config`);
    }
    return { synced: true, models: ollamaModels, changed };
  } catch {
    return { synced: false, models: [], changed: false };
  }
}

ipcMain.handle("sync-ollama-models", async () => {
  const { synced, models } = await syncOllamaModelsToConfig();
  return { synced, models };
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

// Create skill from uploaded file (.md, .zip, .skill)
ipcMain.handle("create-skill-from-file", async (_event, filePath: string) => {
  try {
    const skillsDir = join(homedir(), ".claude", "skills");
    if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });

    const ext = filePath.toLowerCase().split(".").pop() || "";

    if (ext === "md") {
      // Read the .md file and extract skill name from YAML frontmatter
      const content = readFileSync(filePath, "utf-8");
      const nameMatch = content.match(/^---[\s\S]*?name:\s*(.+?)[\s\r\n]/m);
      if (!nameMatch) {
        return {
          ok: false,
          output: "Invalid SKILL.md: missing 'name' in YAML frontmatter.",
        };
      }
      const skillName = nameMatch[1].trim().replace(/[^a-zA-Z0-9_-]/g, "-");
      const destDir = join(skillsDir, skillName);
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      copyFileSync(filePath, join(destDir, "SKILL.md"));
      return { ok: true, output: `Skill "${skillName}" created.` };
    } else if (ext === "zip" || ext === "skill") {
      // Extract zip/skill to a temp dir, find SKILL.md, then move to skills dir
      const tmpDir = join(app.getPath("temp"), `skill-extract-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
      try {
        await execFileAsync("unzip", ["-o", filePath, "-d", tmpDir], {
          timeout: 30_000,
        });
        // Find SKILL.md in extracted contents
        const findSkillMd = (dir: string): string | null => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === "SKILL.md" && entry.isFile()) return dir;
            if (entry.isDirectory() && !entry.name.startsWith(".")) {
              const found = findSkillMd(join(dir, entry.name));
              if (found) return found;
            }
          }
          return null;
        };
        const skillRoot = findSkillMd(tmpDir);
        if (!skillRoot) {
          rmSync(tmpDir, { recursive: true, force: true });
          return { ok: false, output: "Archive must contain a SKILL.md file." };
        }
        // Read skill name from SKILL.md frontmatter
        const mdContent = readFileSync(join(skillRoot, "SKILL.md"), "utf-8");
        const nm = mdContent.match(/^---[\s\S]*?name:\s*(.+?)[\s\r\n]/m);
        const skillName = nm
          ? nm[1].trim().replace(/[^a-zA-Z0-9_-]/g, "-")
          : `skill-${Date.now()}`;
        const destDir = join(skillsDir, skillName);
        if (existsSync(destDir))
          rmSync(destDir, { recursive: true, force: true });
        // Copy extracted skill directory
        cpSync(skillRoot, destDir, { recursive: true });
        rmSync(tmpDir, { recursive: true, force: true });
        return { ok: true, output: `Skill "${skillName}" created.` };
      } catch (err: unknown) {
        rmSync(tmpDir, { recursive: true, force: true });
        throw err;
      }
    } else {
      return { ok: false, output: `Unsupported file type: .${ext}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, output: msg };
  }
});

// Create skill from written instructions (name, description, instructions)
ipcMain.handle(
  "create-skill-from-instructions",
  async (_event, name: string, description: string, instructions: string) => {
    try {
      const skillsDir = join(homedir(), ".claude", "skills");
      if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });

      const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
      if (!safeName) return { ok: false, output: "Skill name is required." };

      const destDir = join(skillsDir, safeName);
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      const content = `---
name: ${name.trim()}
description: ${description.trim()}
---

${instructions.trim()}
`;
      writeFileSync(join(destDir, "SKILL.md"), content, "utf-8");
      return { ok: true, output: `Skill "${safeName}" created.` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, output: msg };
    }
  },
);

// Open native file picker for skill files
ipcMain.handle("pick-skill-file", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Upload Skill",
    filters: [{ name: "Skill files", extensions: ["md", "zip", "skill"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Plugin management
ipcMain.handle(
  "install-plugin",
  async (_event, source: PluginSource, opts?: { overwrite?: boolean }) => {
    return installPluginFromSource(source, opts ?? {});
  },
);

ipcMain.handle("list-installed-plugins", () => {
  return listInstalledPlugins();
});

ipcMain.handle("remove-plugin", (_event, name: string) => {
  return removePlugin(name);
});

ipcMain.handle("pick-plugin-folder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Plugin Folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Marketplaces
ipcMain.handle(
  "add-marketplace",
  async (_event, source: MarketplaceSource) => {
    return addMarketplace(source);
  },
);

ipcMain.handle("list-marketplaces", () => {
  return listMarketplaces();
});

ipcMain.handle("remove-marketplace", (_event, name: string) => {
  return removeMarketplace(name);
});

ipcMain.handle("refresh-marketplace", async (_event, name: string) => {
  return refreshMarketplace(name);
});

ipcMain.handle(
  "install-marketplace-plugin",
  async (_event, marketplaceName: string, pluginName: string) => {
    return installMarketplacePlugin(marketplaceName, pluginName);
  },
);

ipcMain.handle(
  "inspect-marketplace-plugin",
  (_event, marketplaceName: string, pluginName: string) => {
    return inspectMarketplacePlugin(marketplaceName, pluginName);
  },
);

// Open native file picker for chat attachments — returns files as base64 data URLs
const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
};

function mimeFromPath(p: string): string {
  const i = p.lastIndexOf(".");
  if (i === -1) return "application/octet-stream";
  return (
    ATTACHMENT_MIME_BY_EXT[p.slice(i).toLowerCase()] ||
    "application/octet-stream"
  );
}

ipcMain.handle(
  "pick-attachments",
  async (): Promise<
    { filename: string; mime: string; url: string; size: number }[]
  > => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Attach Files",
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    const out: { filename: string; mime: string; url: string; size: number }[] =
      [];
    for (const p of result.filePaths) {
      try {
        const data = readFileSync(p);
        const mime = mimeFromPath(p);
        const filename = p.split("/").pop() || p.split("\\").pop() || "file";
        out.push({
          filename,
          mime,
          url: `data:${mime};base64,${data.toString("base64")}`,
          size: data.length,
        });
      } catch (err) {
        log.warn("Failed to read attachment:", p, err);
      }
    }
    return out;
  },
);

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
ipcMain.handle("list-mcp-servers-fast", () => listMCPServersFast());
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

    syncOllamaModelsToConfig().catch(() => {});

    createWindow();
    setupOllamaPolling();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", async () => {
    stopOllamaPolling();
    await stopSidecar();
  });
}

let ollamaPollTimer: NodeJS.Timeout | null = null;
const OLLAMA_POLL_INTERVAL_MS = 30_000;

function startOllamaPoll() {
  if (ollamaPollTimer) return;
  ollamaPollTimer = setInterval(() => {
    syncOllamaModelsToConfig().catch(() => {});
  }, OLLAMA_POLL_INTERVAL_MS);
}

function stopOllamaPolling() {
  if (ollamaPollTimer) {
    clearInterval(ollamaPollTimer);
    ollamaPollTimer = null;
  }
}

function setupOllamaPolling() {
  if (!mainWindow) return;
  if (mainWindow.isFocused()) startOllamaPoll();
  mainWindow.on("focus", startOllamaPoll);
  mainWindow.on("blur", stopOllamaPolling);
  mainWindow.on("closed", stopOllamaPolling);
}
