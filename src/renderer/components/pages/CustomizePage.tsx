import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { useServerStore } from "../../stores/server-store";
import { listSkills, type SkillInfo } from "../../api/client";
import { restartAndReconnect } from "../../hooks/useDirectoryInstall";
import { SkillDetailView } from "./SkillDetailView";
import { FilePreviewView } from "./FilePreviewView";

const api = (
  window as unknown as { api: import("../../../preload/index").ElectronAPI }
).api;

type Section = "skills" | "connectors" | null;

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPServer {
  name: string;
  type: string;
  command?: string[];
  url?: string;
  tools: MCPTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
  error?: string;
}

interface FileEntry {
  name: string;
  type: "file" | "directory";
}

function isBuiltInSkill(location: string): boolean {
  return (
    location.includes("/.claude/") ||
    location.includes("/.agents/") ||
    location.includes("/node_modules/")
  );
}

function getSkillDir(location: string): string {
  const parts = location.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/");
}

export function CustomizePage() {
  const openDirectory = useSettingsStore((s) => s.openDirectory);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);

  // Navigation
  const [section, setSection] = useState<Section>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    name: string;
  } | null>(null);

  // Skills data
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // MCP servers
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpIntrospecting, setMcpIntrospecting] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [connectorSearch, setConnectorSearch] = useState("");

  // File tree state (lives here so left panel tree and right panel share it)
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>(
    {},
  );
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Load skills when section becomes "skills"
  useEffect(() => {
    if (section !== "skills") return;
    setLoading(true);
    listSkills()
      .then(setSkills)
      .finally(() => setLoading(false));
  }, [section]);

  // Load MCP servers when section becomes "connectors":
  // 1) Show stubs instantly from config, 2) introspect details in background
  useEffect(() => {
    if (section !== "connectors") return;
    setMcpLoading(true);
    api
      .listMCPServersFast()
      .then((stubs) => {
        setMcpServers(stubs);
        setMcpLoading(false);
        // Now introspect in the background
        setMcpIntrospecting(true);
        api
          .listMCPServers()
          .then((full) => {
            setMcpServers(full);
            // Update selected server if it was refreshed
            setSelectedServer((prev) =>
              prev ? (full.find((s) => s.name === prev.name) ?? prev) : null,
            );
          })
          .catch(() => {})
          .finally(() => setMcpIntrospecting(false));
      })
      .catch(() => {
        setMcpServers([]);
        setMcpLoading(false);
      });
  }, [section]);

  const handleRefreshMCP = useCallback(() => {
    setMcpLoading(true);
    api
      .refreshMCPServers()
      .then((servers) => {
        setMcpServers(servers);
        // Re-select if the selected server was refreshed
        if (selectedServer) {
          const updated = servers.find((s) => s.name === selectedServer.name);
          setSelectedServer(updated || null);
        }
      })
      .catch(() => setMcpServers([]))
      .finally(() => setMcpLoading(false));
  }, [selectedServer]);

  const loadDir = useCallback(
    async (dirPath: string) => {
      if (dirContents[dirPath]) return;
      try {
        const files = await api.listSkillFiles(dirPath);
        setDirContents((prev) => ({ ...prev, [dirPath]: files }));
      } catch {
        setDirContents((prev) => ({ ...prev, [dirPath]: [] }));
      }
    },
    [dirContents],
  );

  const handleSelectSkill = useCallback(
    (skill: SkillInfo) => {
      setSelectedSkill(skill);
      setSelectedFile(null);
      const dir = getSkillDir(skill.location);
      loadDir(dir);
    },
    [loadDir],
  );

  const toggleDir = useCallback(
    (dirPath: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(dirPath)) {
          next.delete(dirPath);
        } else {
          next.add(dirPath);
          loadDir(dirPath);
        }
        return next;
      });
    },
    [loadDir],
  );

  const handleOpenFile = useCallback((path: string, name: string) => {
    setSelectedFile({ path, name });
  }, []);

  const handleBackFromSkill = useCallback(() => {
    setSelectedSkill(null);
    setSelectedFile(null);
    setExpandedDirs(new Set());
  }, []);

  const handleBackFromFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleBackToMenu = useCallback(() => {
    setSection(null);
    setSelectedSkill(null);
    setSelectedFile(null);
    setExpandedDirs(new Set());
    setSelectedServer(null);
  }, []);

  const refreshSkills = useCallback(() => {
    setLoading(true);
    listSkills()
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

  const handleRemoveConnector = useCallback(async (serverName: string) => {
    await api.removeMCPConfig(serverName);
    useServerStore.getState().setNeedsRestart(true);
    setSelectedServer(null);
    // Remove from local state immediately
    setMcpServers((prev) => prev.filter((s) => s.name !== serverName));
  }, []);

  const handleRemoveSkill = useCallback(async (location: string) => {
    const result = await api.removeSkill(location);
    if (result.ok) {
      useServerStore.getState().setNeedsRestart(true);
      // Remove from local state immediately (sidecar may cache the old list)
      setSkills((prev) => prev.filter((s) => s.location !== location));
      setSelectedSkill(null);
      setSelectedFile(null);
    } else {
      console.error("Remove failed:", result.output);
    }
  }, []);

  const needsRestart = useServerStore((s) => s.needsRestart);
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      await restartAndReconnect();
      // Refresh MCP servers after restart
      api
        .listMCPServers()
        .then((servers) => {
          setMcpServers(servers);
          if (selectedServer) {
            const updated = servers.find((s) => s.name === selectedServer.name);
            setSelectedServer(updated || null);
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error("Restart failed:", err);
    } finally {
      setRestarting(false);
    }
  }, [selectedServer]);

  const filtered = search.trim()
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  const nodeModuleSkills = filtered.filter((s) =>
    s.location.includes("/node_modules/"),
  );
  const userSkills = filtered.filter(
    (s) => !s.location.includes("/node_modules/"),
  );

  const filteredServers = connectorSearch.trim()
    ? mcpServers.filter((s) =>
        s.name.toLowerCase().includes(connectorSearch.toLowerCase()),
      )
    : mcpServers;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Restart banner */}
      {needsRestart && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-amber-400"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="flex-1 text-xs text-amber-300">
            You need to restart opencowork to take effect.
          </span>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="shrink-0 rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
          >
            {restarting ? "Restarting..." : "Restart"}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* LEFT PANEL */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
          {/* Drag region + back button + title + add */}
          <div className="drag-region flex h-12 shrink-0 items-center gap-2 px-4">
            <button
              onClick={
                section ? handleBackToMenu : () => setRightPanelPage(null)
              }
              className="no-drag rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
              title="Back"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <span className="no-drag text-sm font-semibold text-text">
              {section === "skills"
                ? "Skills"
                : section === "connectors"
                  ? "Connectors"
                  : "Customize"}
            </span>
            <div className="flex-1" />
            <button
              onClick={() =>
                openDirectory(
                  section === "connectors" ? "connectors" : "skills",
                )
              }
              className="no-drag rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
              title="Browse directory"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          {/* Left panel content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {!section && (
              <div className="px-4 pb-6">
                <div className="flex flex-col gap-0.5">
                  <MenuButton
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    }
                    label="Skills"
                    onClick={() => setSection("skills")}
                  />
                  <MenuButton
                    icon={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    }
                    label="Connectors"
                    onClick={() => setSection("connectors")}
                  />
                </div>
              </div>
            )}

            {section === "skills" && (
              <SkillsList
                skills={userSkills}
                builtInSkills={nodeModuleSkills}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                selectedSkill={selectedSkill}
                onSelectSkill={handleSelectSkill}
                onRemoveSkill={handleRemoveSkill}
                dirContents={dirContents}
                expandedDirs={expandedDirs}
                onToggleDir={toggleDir}
                onOpenFile={handleOpenFile}
                onAdd={() => openDirectory("skills")}
              />
            )}

            {section === "connectors" && (
              <ConnectorsList
                servers={filteredServers}
                loading={mcpLoading}
                introspecting={mcpIntrospecting}
                search={connectorSearch}
                onSearchChange={setConnectorSearch}
                selectedServer={selectedServer}
                onSelectServer={setSelectedServer}
                onRefresh={handleRefreshMCP}
                onAdd={() => openDirectory("connectors")}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="drag-region h-12 w-full shrink-0" />
          <div className="flex-1 overflow-y-auto">
            {selectedFile && selectedSkill ? (
              <FilePreviewView
                filePath={selectedFile.path}
                fileName={selectedFile.name}
                skillName={selectedSkill.name}
                onBack={handleBackFromFile}
              />
            ) : selectedSkill ? (
              <SkillDetailView
                skill={selectedSkill}
                onBack={handleBackFromSkill}
                onRemove={() => handleRemoveSkill(selectedSkill.location)}
              />
            ) : selectedServer ? (
              <ConnectorDetailView
                server={selectedServer}
                introspecting={mcpIntrospecting}
                onBack={() => setSelectedServer(null)}
                onRemove={handleRemoveConnector}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-tertiary">
                  {section
                    ? "Select an item to view details."
                    : "Select a category to get started."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Skills List (left panel) ─────────────────────────────────── */

function SkillsList({
  skills,
  builtInSkills,
  loading,
  search,
  onSearchChange,
  selectedSkill,
  onSelectSkill,
  onRemoveSkill,
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
  onAdd,
}: {
  skills: SkillInfo[];
  builtInSkills: SkillInfo[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedSkill: SkillInfo | null;
  onSelectSkill: (skill: SkillInfo) => void;
  onRemoveSkill: (name: string) => void;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col px-3 pb-4">
      {/* Search */}
      <div className="relative mb-3 px-1">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search skills..."
          className="w-full rounded-md border border-border bg-surface-secondary py-1.5 pl-8 pr-3 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="px-1 text-xs text-text-tertiary">Loading...</p>
      ) : skills.length === 0 && builtInSkills.length === 0 ? (
        <p className="px-1 text-xs text-text-tertiary">
          {search ? "No matching skills." : "No skills found."}
        </p>
      ) : (
        <SkillGroup
          skills={[...skills, ...builtInSkills]}
          selectedSkill={selectedSkill}
          onSelectSkill={onSelectSkill}
          onRemoveSkill={onRemoveSkill}
          dirContents={dirContents}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
        />
      )}
    </div>
  );
}

/* ── Skill Group with file tree ───────────────────────────────── */

function SkillGroup({
  skills,
  selectedSkill,
  onSelectSkill,
  onRemoveSkill,
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
}: {
  skills: SkillInfo[];
  selectedSkill: SkillInfo | null;
  onSelectSkill: (skill: SkillInfo) => void;
  onRemoveSkill?: (name: string) => void;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {skills.map((skill) => {
        const isSelected = selectedSkill?.name === skill.name;
        const dir = getSkillDir(skill.location);
        const files = dirContents[dir];

        return (
          <div key={skill.name}>
            {/* Skill row */}
            <button
              onClick={() => onSelectSkill(skill)}
              className={`group/row flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-accent/10 text-accent"
                  : "text-text hover:bg-surface-hover"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  isSelected
                    ? "bg-accent/20 text-accent"
                    : "bg-surface-tertiary text-text-tertiary"
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {skill.name}
              </span>
              {/* Chevron */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 text-text-tertiary transition-transform ${isSelected ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* File tree under selected skill */}
            {isSelected && (
              <div className="ml-4 border-l border-border pl-3 pt-1 pb-1">
                <FileTree
                  parentDir={dir}
                  entries={files}
                  dirContents={dirContents}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  onOpenFile={onOpenFile}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── File Tree ────────────────────────────────────────────────── */

function FileTree({
  parentDir,
  entries,
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
}: {
  parentDir: string;
  entries: FileEntry[] | undefined;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  if (!entries) {
    return <p className="py-0.5 text-[11px] text-text-tertiary">Loading...</p>;
  }
  if (entries.length === 0) {
    return <p className="py-0.5 text-[11px] text-text-tertiary">No files.</p>;
  }

  return (
    <>
      {entries.map((f) => {
        const fullPath = `${parentDir}/${f.name}`;
        const isDir = f.type === "directory";
        const isOpen = expandedDirs.has(fullPath);
        const subEntries = dirContents[fullPath];

        return (
          <div key={f.name}>
            {isDir ? (
              <button
                onClick={() => onToggleDir(fullPath)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="shrink-0 text-text-tertiary"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="truncate">{f.name}</span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`ml-auto shrink-0 text-text-tertiary transition-transform ${isOpen ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => onOpenFile(fullPath, f.name)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="shrink-0 text-text-tertiary"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate">{f.name}</span>
              </button>
            )}

            {isDir && isOpen && (
              <div className="ml-2.5 border-l border-border pl-2">
                <FileTree
                  parentDir={fullPath}
                  entries={subEntries}
                  dirContents={dirContents}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  onOpenFile={onOpenFile}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Connectors List (left panel) ─────────────────────────────── */

function ConnectorsList({
  servers,
  loading,
  introspecting,
  search,
  onSearchChange,
  selectedServer,
  onSelectServer,
  onRefresh,
  onAdd,
}: {
  servers: MCPServer[];
  loading: boolean;
  introspecting: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedServer: MCPServer | null;
  onSelectServer: (s: MCPServer) => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col px-3 pb-4">
      <div className="relative mb-3 mt-3 px-1">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search connectors..."
          className="w-full rounded-md border border-border bg-surface-secondary py-1.5 pl-8 pr-3 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="px-1 text-xs text-text-tertiary">
          Connecting to MCP servers...
        </p>
      ) : servers.length === 0 ? (
        <p className="px-1 text-xs text-text-tertiary">
          {search ? "No matching connectors." : "No MCP connectors configured."}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {servers.map((server) => {
            const isSelected = selectedServer?.name === server.name;
            const totalItems =
              server.tools.length +
              server.prompts.length +
              server.resources.length;
            return (
              <button
                key={server.name}
                onClick={() => onSelectServer(server)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                  isSelected
                    ? "bg-accent/10 text-accent"
                    : "text-text hover:bg-surface-hover"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    isSelected
                      ? "bg-accent/20 text-accent"
                      : server.error
                        ? "bg-red-500/10 text-red-400"
                        : "bg-surface-tertiary text-text-tertiary"
                  }`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{server.name}</span>
                  <span className="block truncate text-[11px] text-text-tertiary">
                    {server.error
                      ? "Error"
                      : introspecting && totalItems === 0
                        ? "Loading\u2026"
                        : totalItems > 0
                          ? `${totalItems} item${totalItems !== 1 ? "s" : ""}`
                          : server.type}
                  </span>
                </div>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`shrink-0 text-text-tertiary transition-transform ${isSelected ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Connector Detail View (right panel) ─────────────────────── */

type DetailTab = "tools" | "prompts" | "resources";

function ConnectorDetailView({
  server,
  introspecting,
  onBack,
  onRemove,
}: {
  server: MCPServer;
  introspecting?: boolean;
  onBack: () => void;
  onRemove?: (serverName: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("tools");
  const totalItems =
    server.tools.length + server.prompts.length + server.resources.length;
  const isLoading = introspecting && totalItems === 0 && !server.error;

  const tabs: { key: DetailTab; label: string; count: number }[] = [
    { key: "tools", label: "Tools", count: server.tools.length },
    { key: "prompts", label: "Prompts", count: server.prompts.length },
    { key: "resources", label: "Resources", count: server.resources.length },
  ];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-text">
            {server.name}
          </h3>
          {onRemove && (
            <button
              onClick={() => onRemove(server.name)}
              className="shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
            >
              Remove
            </button>
          )}
        </div>

        {/* Metadata */}
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Type</span>
            <div className="mt-0.5 text-text">{server.type}</div>
          </div>
          {server.command && (
            <div className="min-w-0">
              <span className="text-text-tertiary">Command</span>
              <div
                className="mt-0.5 max-w-[300px] truncate font-mono text-text"
                title={server.command.join(" ")}
              >
                {server.command.join(" ")}
              </div>
            </div>
          )}
          {server.url && (
            <div className="min-w-0">
              <span className="text-text-tertiary">URL</span>
              <div
                className="mt-0.5 max-w-[300px] truncate text-text"
                title={server.url}
              >
                {server.url}
              </div>
            </div>
          )}
        </div>

        {server.error && (
          <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {server.error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent/10 text-accent"
                  : "text-text-tertiary hover:bg-surface-hover hover:text-text"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-w-0 px-6 pt-4 pb-8">
        {isLoading ? (
          <p className="text-sm text-text-tertiary">
            Loading tools and resources...
          </p>
        ) : (
          <>
            {tab === "tools" && <ToolsTab tools={server.tools} />}
            {tab === "prompts" && <PromptsTab prompts={server.prompts} />}
            {tab === "resources" && (
              <ResourcesTab resources={server.resources} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Tools Tab ────────────────────────────────────────────────── */

function ToolsTab({ tools }: { tools: MCPTool[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (tools.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No tools exposed by this server.
      </p>
    );
  }

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool) => {
        const isOpen = expanded.has(tool.name);
        const schema = tool.inputSchema;
        const properties = schema?.properties as
          | Record<string, Record<string, unknown>>
          | undefined;
        const required = (schema?.required as string[]) || [];

        return (
          <div
            key={tool.name}
            className="min-w-0 rounded-lg border border-border bg-surface-secondary"
          >
            <button
              onClick={() => toggle(tool.name)}
              className="flex w-full items-center gap-2 overflow-hidden px-4 py-3 text-left"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-400">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text">
                  {tool.name}
                </span>
                {tool.description && (
                  <span className="block text-xs leading-relaxed text-text-tertiary line-clamp-2">
                    {tool.description}
                  </span>
                )}
              </div>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 text-text-tertiary transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 py-3">
                {tool.description && (
                  <p className="mb-3 text-xs leading-relaxed text-text-secondary">
                    {tool.description}
                  </p>
                )}
                {properties && Object.keys(properties).length > 0 ? (
                  <div>
                    <h5 className="mb-2 text-[11px] font-medium text-text-tertiary">
                      Parameters
                    </h5>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(properties).map(([name, prop]) => (
                        <div
                          key={name}
                          className="rounded-md bg-surface px-3 py-2"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <code className="font-mono text-xs text-accent">
                              {name}
                            </code>
                            <span className="text-[11px] text-text-tertiary">
                              {(prop.type as string) || "any"}
                            </span>
                            {required.includes(name) && (
                              <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-medium text-red-400">
                                required
                              </span>
                            )}
                          </div>
                          {prop.description && (
                            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                              {prop.description as string}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">No parameters.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Prompts Tab ──────────────────────────────────────────────── */

function PromptsTab({ prompts }: { prompts: MCPPrompt[] }) {
  if (prompts.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No prompts exposed by this server.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {prompts.map((prompt) => (
        <div
          key={prompt.name}
          className="rounded-lg border border-border bg-surface-secondary px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-400">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span className="text-sm font-medium text-text">{prompt.name}</span>
          </div>
          {prompt.description && (
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {prompt.description}
            </p>
          )}
          {prompt.arguments && prompt.arguments.length > 0 && (
            <div className="mt-3">
              <h5 className="mb-1.5 text-[11px] font-medium text-text-tertiary">
                Arguments
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {prompt.arguments.map((arg) => (
                  <span
                    key={arg.name}
                    className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs"
                    title={arg.description}
                  >
                    <code className="font-mono text-accent">{arg.name}</code>
                    {arg.required && (
                      <span className="text-[9px] text-red-400">*</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Resources Tab ────────────────────────────────────────────── */

function ResourcesTab({ resources }: { resources: MCPResource[] }) {
  if (resources.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No resources exposed by this server.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {resources.map((resource) => (
        <div
          key={resource.uri}
          className="rounded-lg border border-border bg-surface-secondary px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-green-500/10 text-green-400">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </span>
            <span className="text-sm font-medium text-text">
              {resource.name}
            </span>
            {resource.mimeType && (
              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-tertiary">
                {resource.mimeType}
              </span>
            )}
          </div>
          <div
            className="mt-1 truncate font-mono text-[11px] text-text-tertiary"
            title={resource.uri}
          >
            {resource.uri}
          </div>
          {resource.description && (
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {resource.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Menu Button ──────────────────────────────────────────────── */

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}
