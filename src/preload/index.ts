import { contextBridge, ipcRenderer } from "electron";

export type PluginFormat = "claude" | "codex";

export type PluginSourceDescriptor =
  | { type: "github"; repo: string; ref?: string }
  | { type: "url"; url: string; ref?: string }
  | { type: "local"; path: string };

export interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: { name?: string; email?: string; url?: string } | string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}

export interface PluginComponentItem {
  name: string;
  path: string;
  description?: string;
}

export interface PluginComponents {
  skills: PluginComponentItem[];
  mcpServers: { name: string; config: Record<string, unknown> }[];
  agents: PluginComponentItem[];
  commands: PluginComponentItem[];
  hooks: PluginComponentItem[];
  lsp: PluginComponentItem[];
  monitors: PluginComponentItem[];
}

export interface InstalledPlugin {
  name: string;
  source: PluginSourceDescriptor;
  installedAt: number;
  format: PluginFormat;
  manifest: PluginManifest;
  installDir: string;
  cloneRoot?: string;
  subdir?: string;
  marketplaceName?: string;
  mirroredSkills: string[];
  mergedMcpKeys: string[];
  components: {
    skills: number;
    mcpServers: number;
    agents: number;
    commands: number;
    hooks: number;
    lsp: number;
    monitors: number;
  };
}

export type MarketplaceSourceDescriptor =
  | { type: "github"; repo: string; ref?: string }
  | { type: "url"; url: string; ref?: string }
  | { type: "local"; path: string };

export interface MarketplacePluginSource {
  source: "github" | "url" | "git-subdir" | "npm" | "local";
  repo?: string;
  url?: string;
  path?: string;
  ref?: string;
  sha?: string;
  package?: string;
  version?: string;
}

export interface MarketplacePluginEntry {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  source: MarketplacePluginSource;
}

export interface Marketplace {
  name: string;
  displayName?: string;
  addedAt: number;
  source: MarketplaceSourceDescriptor;
  marketplaceDir: string;
  plugins: MarketplacePluginEntry[];
  error?: string;
}

export interface MarketplacePluginInspection {
  entry: MarketplacePluginEntry;
  inspected: boolean;
  manifest?: PluginManifest;
  format?: PluginFormat;
  inventory?: PluginComponents;
  error?: string;
}

export type ServerInfo = { url: string; password: string } | null;

export type OpencodeMigrationProgress =
  | { type: "InProgress"; value: number }
  | { type: "Done" };

const api = {
  getServerUrl: (): Promise<ServerInfo> =>
    ipcRenderer.invoke("get-server-url"),
  onOpencodeMigrationProgress: (
    callback: (progress: OpencodeMigrationProgress) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: OpencodeMigrationProgress,
    ) => callback(progress);
    ipcRenderer.on("opencode-migration-progress", handler);
    return () =>
      ipcRenderer.removeListener("opencode-migration-progress", handler);
  },
  openDirectoryPicker: (): Promise<string | null> =>
    ipcRenderer.invoke("open-directory-picker"),
  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke("show-notification", title, body),
  getPlatform: (): Promise<string> => ipcRenderer.invoke("get-platform"),
  openInFileManager: (path: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("open-in-file-manager", path),
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
  restartSidecar: (): Promise<ServerInfo> =>
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

  // Plugins
  installPlugin: (
    source:
      | { type: "github"; repo: string; ref?: string }
      | { type: "url"; url: string; ref?: string }
      | { type: "local"; path: string },
    opts?: { overwrite?: boolean },
  ): Promise<
    | {
        ok: true;
        plugin: InstalledPlugin;
        inventory: PluginComponents;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("install-plugin", source, opts),
  listInstalledPlugins: (): Promise<InstalledPlugin[]> =>
    ipcRenderer.invoke("list-installed-plugins"),
  removePlugin: (
    name: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("remove-plugin", name),
  pickPluginFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("pick-plugin-folder"),

  pathExists: (path: string): Promise<boolean> =>
    ipcRenderer.invoke("path-exists", path),

  // Marketplaces
  addMarketplace: (
    source: MarketplaceSourceDescriptor,
  ): Promise<
    { ok: true; marketplace: Marketplace } | { ok: false; error: string }
  > => ipcRenderer.invoke("add-marketplace", source),
  listMarketplaces: (): Promise<Marketplace[]> =>
    ipcRenderer.invoke("list-marketplaces"),
  removeMarketplace: (
    name: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("remove-marketplace", name),
  refreshMarketplace: (
    name: string,
  ): Promise<
    { ok: true; marketplace: Marketplace } | { ok: false; error: string }
  > => ipcRenderer.invoke("refresh-marketplace", name),
  installMarketplacePlugin: (
    marketplaceName: string,
    pluginName: string,
  ): Promise<
    | {
        ok: true;
        plugin: InstalledPlugin;
        inventory: PluginComponents;
      }
    | { ok: false; error: string }
  > =>
    ipcRenderer.invoke(
      "install-marketplace-plugin",
      marketplaceName,
      pluginName,
    ),
  inspectMarketplacePlugin: (
    marketplaceName: string,
    pluginName: string,
  ): Promise<MarketplacePluginInspection | { error: string }> =>
    ipcRenderer.invoke(
      "inspect-marketplace-plugin",
      marketplaceName,
      pluginName,
    ),

  // Pick chat attachments via native dialog — returns base64 data URLs directly
  pickAttachments: (): Promise<
    { filename: string; mime: string; url: string; size: number }[]
  > => ipcRenderer.invoke("pick-attachments"),
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
