import { useCallback, useEffect, useState } from "react";
import { listSkills, type SkillInfo } from "../../api/client";
import { SkillDetailView } from "./SkillDetailView";
import { FilePreviewModal } from "./FilePreviewModal";

const api = (
  window as unknown as { api: import("../../../preload/index").ElectronAPI }
).api;

interface FileEntry {
  name: string;
  type: "file" | "directory";
}

// Determine if a skill is "built-in" (lives in ~/.claude or ~/.agents)
function isBuiltInSkill(location: string): boolean {
  return (
    location.includes("/.claude/") ||
    location.includes("/.agents/") ||
    location.includes("/node_modules/")
  );
}

function getSkillDir(location: string): string {
  const parts = location.replace(/\\/g, "/").split("/");
  parts.pop(); // remove SKILL.md
  return parts.join("/");
}

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  // Cache of directory listings keyed by absolute path
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>(
    {},
  );
  // Set of expanded directory paths (subdirectories within a skill)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  // File preview
  const [previewFile, setPreviewFile] = useState<{
    path: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    listSkills()
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

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

  const toggleSkill = useCallback(
    (skill: SkillInfo) => {
      const key = skill.name;
      if (expandedSkill === key) {
        setExpandedSkill(null);
        setExpandedDirs(new Set());
      } else {
        setExpandedSkill(key);
        setExpandedDirs(new Set());
        loadDir(getSkillDir(skill.location));
      }
    },
    [expandedSkill, loadDir],
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

  const filtered = search.trim()
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  const openFile = useCallback(
    (path: string, name: string) => setPreviewFile({ path, name }),
    [],
  );

  const personalSkills = filtered.filter((s) => !isBuiltInSkill(s.location));
  const builtInSkills = filtered.filter((s) => isBuiltInSkill(s.location));

  // Detail view
  if (selectedSkill) {
    return (
      <SkillDetailView
        skill={selectedSkill}
        onBack={() => setSelectedSkill(null)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col px-6 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">Skills</h3>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-44 rounded-md border border-border bg-surface-secondary py-1.5 pl-8 pr-3 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
            {/* Add button */}
            <button
              className="rounded-md border border-border p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
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
        </div>

        {loading ? (
          <p className="text-sm text-text-tertiary">Loading skills...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            {search ? "No matching skills." : "No skills found."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {personalSkills.length > 0 && (
              <SkillGroup
                title="Personal skills"
                skills={personalSkills}
                expandedSkill={expandedSkill}
                dirContents={dirContents}
                expandedDirs={expandedDirs}
                onToggleSkill={toggleSkill}
                onSelectSkill={setSelectedSkill}
                onToggleDir={toggleDir}
                onOpenFile={openFile}
              />
            )}
            {builtInSkills.length > 0 && (
              <SkillGroup
                title="Built-in skills"
                skills={builtInSkills}
                expandedSkill={expandedSkill}
                dirContents={dirContents}
                expandedDirs={expandedDirs}
                onToggleSkill={toggleSkill}
                onSelectSkill={setSelectedSkill}
                onToggleDir={toggleDir}
                onOpenFile={openFile}
              />
            )}
          </div>
        )}
      </div>

      {/* File preview modal */}
      {previewFile && (
        <FilePreviewModal
          filePath={previewFile.path}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}

function SkillGroup({
  title,
  skills,
  expandedSkill,
  dirContents,
  expandedDirs,
  onToggleSkill,
  onSelectSkill,
  onToggleDir,
  onOpenFile,
}: {
  title: string;
  skills: SkillInfo[];
  expandedSkill: string | null;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleSkill: (skill: SkillInfo) => void;
  onSelectSkill: (skill: SkillInfo) => void;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text"
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
            const isExpanded = expandedSkill === skill.name;
            const dir = getSkillDir(skill.location);
            const files = dirContents[dir];

            return (
              <div key={skill.name}>
                {/* Skill row */}
                <div
                  className={`flex w-full items-center rounded-lg transition-colors ${
                    isExpanded ? "bg-surface-hover" : "hover:bg-surface-hover"
                  }`}
                >
                  {/* Clickable name area — opens detail */}
                  <button
                    onClick={() => onSelectSkill(skill)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                      {skill.name}
                    </span>
                  </button>
                  {/* Chevron — toggles file tree */}
                  <button
                    onClick={() => onToggleSkill(skill)}
                    className="shrink-0 px-3 py-2 text-text-tertiary transition-colors hover:text-text"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                {/* Expanded file tree */}
                {isExpanded && (
                  <div className="ml-5 border-l border-border pl-4 pt-1 pb-1">
                    <FileTree
                      parentDir={dir}
                      entries={files}
                      dirContents={dirContents}
                      expandedDirs={expandedDirs}
                      onToggleDir={onToggleDir}
                      onOpenFile={onOpenFile}
                      depth={0}
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

function FileTree({
  parentDir,
  entries,
  dirContents,
  expandedDirs,
  onToggleDir,
  onOpenFile,
  depth,
}: {
  parentDir: string;
  entries: FileEntry[] | undefined;
  dirContents: Record<string, FileEntry[]>;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (path: string, name: string) => void;
  depth: number;
}) {
  if (!entries) {
    return <p className="py-1 text-xs text-text-tertiary">Loading...</p>;
  }
  if (entries.length === 0) {
    return <p className="py-1 text-xs text-text-tertiary">Empty folder.</p>;
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
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="12"
                  height="12"
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
                  width="10"
                  height="10"
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
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="12"
                  height="12"
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

            {/* Nested directory contents */}
            {isDir && isOpen && (
              <div className="ml-3 border-l border-border pl-3">
                <FileTree
                  parentDir={fullPath}
                  entries={subEntries}
                  dirContents={dirContents}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  onOpenFile={onOpenFile}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
