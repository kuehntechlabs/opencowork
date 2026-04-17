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
  getRecentDirectories: (): Promise<{ path: string; lastUsed: number }[]> =>
    ipcRenderer.invoke("get-recent-directories"),
  addRecentDirectory: (path: string): Promise<void> =>
    ipcRenderer.invoke("add-recent-directory", path),

  // MCP config
  writeMCPConfig: (mcpConfig: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke("write-mcp-config", mcpConfig),
  removeMCPConfig: (serverName: string): Promise<void> =>
    ipcRenderer.invoke("remove-mcp-config", serverName),

  // MCP introspection
  listMCPServers: (): Promise<
    {
      name: string;
      type: string;
      command?: string[];
      url?: string;
      tools: {
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }[];
      prompts: {
        name: string;
        description?: string;
        arguments?: {
          name: string;
          description?: string;
          required?: boolean;
        }[];
      }[];
      resources: {
        uri: string;
        name: string;
        description?: string;
        mimeType?: string;
      }[];
      error?: string;
    }[]
  > => ipcRenderer.invoke("list-mcp-servers"),
  listMCPServersFast: (): Promise<
    {
      name: string;
      type: string;
      command?: string[];
      url?: string;
      tools: [];
      prompts: [];
      resources: [];
    }[]
  > => ipcRenderer.invoke("list-mcp-servers-fast"),
  refreshMCPServers: (): Promise<
    {
      name: string;
      type: string;
      command?: string[];
      url?: string;
      tools: {
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }[];
      prompts: {
        name: string;
        description?: string;
        arguments?: {
          name: string;
          description?: string;
          required?: boolean;
        }[];
      }[];
      resources: {
        uri: string;
        name: string;
        description?: string;
        mimeType?: string;
      }[];
      error?: string;
    }[]
  > => ipcRenderer.invoke("refresh-mcp-servers"),

  // Skills management
  listInstalledSkills: (): Promise<string[]> =>
    ipcRenderer.invoke("list-installed-skills"),
  installSkill: (
    source: string,
    skillName: string,
  ): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke("install-skill", source, skillName),
  removeSkill: (skillName: string): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke("remove-skill", skillName),

  // Ollama model sync
  syncOllamaModels: (): Promise<{ synced: boolean; models: string[] }> =>
    ipcRenderer.invoke("sync-ollama-models"),

  // Proxy fetch (bypass CORS)
  fetchUrl: (
    url: string,
  ): Promise<{ ok: boolean; status: number; body: string }> =>
    ipcRenderer.invoke("fetch-url", url),

  // Skills
  listSkillFiles: (
    dirPath: string,
  ): Promise<{ name: string; type: "file" | "directory" }[]> =>
    ipcRenderer.invoke("list-skill-files", dirPath),
  readSkillFile: (
    filePath: string,
  ): Promise<{ type: "text" | "image"; content: string } | null> =>
    ipcRenderer.invoke("read-skill-file", filePath),

  // Create skill from uploaded file (.md, .zip, .skill)
  createSkillFromFile: (
    filePath: string,
  ): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke("create-skill-from-file", filePath),

  // Create skill from written instructions
  createSkillFromInstructions: (
    name: string,
    description: string,
    instructions: string,
  ): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke(
      "create-skill-from-instructions",
      name,
      description,
      instructions,
    ),

  // Pick a skill file via native dialog
  pickSkillFile: (): Promise<string | null> =>
    ipcRenderer.invoke("pick-skill-file"),

  // Pick chat attachments via native dialog — returns base64 data URLs directly
  pickAttachments: (): Promise<
    { filename: string; mime: string; url: string; size: number }[]
  > => ipcRenderer.invoke("pick-attachments"),
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
