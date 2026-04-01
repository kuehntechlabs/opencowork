import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { join } from "node:path";
import log from "electron-log";
import {
  startSidecar,
  stopSidecar,
  getSidecarUrl,
  readOpencodeConfig,
  writeProviderConfig,
  restartSidecar,
} from "./sidecar";
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
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
