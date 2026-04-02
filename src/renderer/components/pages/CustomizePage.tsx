import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { listSkills, type SkillInfo } from "../../api/client";
import { SkillDetailView } from "./SkillDetailView";
import { FilePreviewView } from "./FilePreviewView";

const api = (
  window as unknown as { api: import("../../../preload/index").ElectronAPI }
).api;

type Section = "skills" | "connectors" | null;

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
      // Auto-load the skill's root dir
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
  }, []);

  const filtered = search.trim()
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  const personalSkills = filtered.filter((s) => !isBuiltInSkill(s.location));
  const builtInSkills = filtered.filter((s) => isBuiltInSkill(s.location));

  return (
    <div className="flex h-full min-h-0">
      {/* LEFT PANEL */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        {/* Drag region + back button */}
        <div className="drag-region flex h-12 shrink-0 items-center px-4">
          <button
            onClick={section ? handleBackToMenu : () => setRightPanelPage(null)}
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
        </div>

        {/* Left panel content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {!section && (
            <div className="px-4 pb-6">
              <h2 className="mb-5 text-lg font-semibold text-text">
                Customize
              </h2>
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
              skills={personalSkills}
              builtInSkills={builtInSkills}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
              selectedSkill={selectedSkill}
              onSelectSkill={handleSelectSkill}
              dirContents={dirContents}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
              onOpenFile={handleOpenFile}
            />
          )}

          {section === "connectors" && (
            <div className="px-4 pb-6">
              <h2 className="mb-3 text-lg font-semibold text-text">
                Connectors
              </h2>
              <p className="text-sm text-text-tertiary">
                MCP connectors coming soon.
              </p>
            </div>
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
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
}: {
  skills: SkillInfo[];
  builtInSkills: SkillInfo[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedSkill: SkillInfo | null;
  onSelectSkill: (skill: SkillInfo) => void;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  return (
    <div className="flex flex-col px-3 pb-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-text">Skills</h2>
        <button
          className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          title="Add skill"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

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
        <div className="flex flex-col gap-3">
          {skills.length > 0 && (
            <SkillGroup
              title="Personal skills"
              skills={skills}
              selectedSkill={selectedSkill}
              onSelectSkill={onSelectSkill}
              dirContents={dirContents}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
            />
          )}
          {builtInSkills.length > 0 && (
            <SkillGroup
              title="Built-in skills"
              skills={builtInSkills}
              selectedSkill={selectedSkill}
              onSelectSkill={onSelectSkill}
              dirContents={dirContents}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Skill Group with file tree ───────────────────────────────── */

function SkillGroup({
  title,
  skills,
  selectedSkill,
  onSelectSkill,
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
}: {
  title: string;
  skills: SkillInfo[];
  selectedSkill: SkillInfo | null;
  onSelectSkill: (skill: SkillInfo) => void;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium text-text-tertiary hover:text-text"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {title}
      </button>

      {!collapsed && (
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
      )}
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
