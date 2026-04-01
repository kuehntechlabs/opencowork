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
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
