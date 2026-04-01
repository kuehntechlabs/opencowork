import { useState, useEffect, useRef } from "react";
import { useServerStore } from "../../stores/server-store";
import { useProjectStore } from "../../stores/project-store";

export function FolderPicker() {
  const directory = useServerStore((s) => s.directory);
  const setDirectory = useServerStore((s) => s.setDirectory);
  const {
    projects,
    recentDirectories,
    loadProjects,
    loadRecentDirectories,
    setNewProjectModalOpen,
    addRecentDirectory,
  } = useProjectStore();

  const [open, setOpen] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    loadRecentDirectories();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowProjects(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectDirectory = (path: string) => {
    setDirectory(path);
    addRecentDirectory(path);
    setOpen(false);
    setShowProjects(false);
  };

  const handlePickFolder = async () => {
    const path = await window.api.openDirectoryPicker();
    if (path) selectDirectory(path);
  };

  const folderName = directory?.split("/").pop() || "";

  // Recent dirs excluding current and project dirs
  const projectPaths = new Set(projects.map((p) => p.path));
  const recentDirs = recentDirectories
    .filter((r) => r.path !== directory && !projectPaths.has(r.path))
    .slice(0, 5);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => {
          setOpen(!open);
          setShowProjects(false);
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-2.5 text-sm transition-colors hover:border-border-secondary hover:bg-surface-hover"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-accent"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-text">
          {folderName || "Choose directory"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-text-tertiary"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-lg border border-border bg-surface-secondary shadow-lg">
          {!showProjects ? (
            <>
              {/* Current directory */}
              {directory && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase text-text-tertiary">
                    Current
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-accent">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {folderName}
                      </div>
                      <div className="truncate text-[11px] text-text-tertiary">
                        {directory}
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </>
              )}

              {/* Recent */}
              {recentDirs.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase text-text-tertiary">
                    Recent
                  </div>
                  {recentDirs.map((r) => (
                    <button
                      key={r.path}
                      onClick={() => selectDirectory(r.path)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-surface-hover"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="shrink-0 text-text-tertiary"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-text">
                          {r.path.split("/").pop()}
                        </div>
                        <div className="truncate text-[10px] text-text-tertiary">
                          {r.path}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Choose folder */}
              <button
                onClick={handlePickFolder}
                className="flex w-full items-center gap-2 border-t border-border/30 px-3 py-2 text-left text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-text-tertiary"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                  />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Choose another folder
              </button>

              {/* Projects */}
              <button
                onClick={() => setShowProjects(true)}
                className="flex w-full items-center justify-between border-t border-border/30 px-3 py-2 text-left text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-text-tertiary"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                  Projects
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-text-tertiary"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          ) : (
            /* Projects sub-panel */
            <>
              <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
                <button
                  onClick={() => setShowProjects(false)}
                  className="rounded p-0.5 text-text-tertiary hover:text-text"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="text-xs font-medium text-text">Projects</span>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-tertiary">
                    No projects yet
                  </div>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => selectDirectory(p.path)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover ${
                        directory === p.path ? "text-accent" : "text-text"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="shrink-0"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">
                          {p.name}
                        </div>
                        <div className="truncate text-[10px] text-text-tertiary">
                          {p.path}
                        </div>
                      </div>
                      {directory === p.path && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* New project */}
              <button
                onClick={() => {
                  setOpen(false);
                  setShowProjects(false);
                  setNewProjectModalOpen(true);
                }}
                className="flex w-full items-center gap-2 border-t border-border/30 px-3 py-2 text-left text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-text-tertiary"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
