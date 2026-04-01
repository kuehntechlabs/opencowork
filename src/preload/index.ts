import { contextBridge, ipcRenderer } from "electron";

const api = {
  getServerUrl: (): Promise<string | null> =>
    ipcRenderer.invoke("get-server-url"),
  openDirectoryPicker: (): Promise<string | null> =>
    ipcRenderer.invoke("open-directory-picker"),
  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke("show-notification", title, body),
  getPlatform: (): Promise<string> => ipcRenderer.invoke("get-platform"),
  onMenuCommand: (callback: (command: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, command: string) =>
      callback(command);
    ipcRenderer.on("menu-command", handler);
    return () => ipcRenderer.removeListener("menu-command", handler);
  },
  readProviderConfig: (): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke("read-provider-config"),
  writeProviderConfig: (config: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke("write-provider-config", config),
  restartSidecar: (): Promise<string | null> =>
    ipcRenderer.invoke("restart-sidecar"),

  // Projects
  listProjects: (): Promise<
    {
      name: string;
      path: string;
      hasAgentsMd: boolean;
      createdAt: number;
    }[]
  > => ipcRenderer.invoke("list-projects"),
  createProject: (opts: {
    name: string;
    instructions?: string;
    filePaths?: string[];
  }): Promise<{
    name: string;
    path: string;
    hasAgentsMd: boolean;
    createdAt: number;
  }> => ipcRenderer.invoke("create-project", opts),
  deleteProject: (name: string): Promise<boolean> =>
    ipcRenderer.invoke("delete-project", name),
  openFilePicker: (): Promise<string[]> =>
    ipcRenderer.invoke("open-file-picker"),
  getRecentDirectories: (): Promise<
    { path: string; lastUsed: number }[]
  > => ipcRenderer.invoke("get-recent-directories"),
  addRecentDirectory: (path: string): Promise<void> =>
    ipcRenderer.invoke("add-recent-directory", path),
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
