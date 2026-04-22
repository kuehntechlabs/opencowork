import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectStore, type Project } from "../../stores/project-store";
import { useServerStore } from "../../stores/server-store";
import { useSessionStore } from "../../stores/session-store";
import { useSettingsStore } from "../../stores/settings-store";

export function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const setNewProjectModalOpen = useProjectStore(
    (s) => s.setNewProjectModalOpen,
  );
  const setDirectory = useServerStore((s) => s.setDirectory);
  const addRecentDirectory = useProjectStore((s) => s.addRecentDirectory);
  const createSession = useSessionStore((s) => s.createSession);
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const permissionMode = useSettingsStore((s) => s.permissionMode);

  const [search, setSearch] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      // Wipe sessions bound to this directory first so the sidebar updates.
      await useSessionStore
        .getState()
        .deleteSessionsForDirectory(projectToDelete.path);
      await deleteProject(projectToDelete.name);
      setProjectToDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete project",
      );
    } finally {
      setDeleting(false);
    }
  }, [projectToDelete, deleteProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const handleProjectClick = async (project: {
    name: string;
    path: string;
  }) => {
    setDirectory(project.path);
    addRecentDirectory(project.path);
    const action = permissionMode === "bypass" ? "allow" : "ask";
    try {
      await createSession(project.path, action);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
    setRightPanelPage(null);
  };

  const handleNewProject = () => {
    setNewProjectModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Projects</h1>
        <button
          onClick={handleNewProject}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
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
          New project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full rounded-lg border border-border bg-surface-secondary py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      </div>

      {/* Project list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-text-tertiary">
          Loading projects...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-text-tertiary">
          {search
            ? "No matching projects"
            : "No projects yet. Create one to get started."}
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((project) => (
            <div
              key={project.name}
              className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-hover"
            >
              <button
                onClick={() => handleProjectClick(project)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mt-0.5 shrink-0 text-text-tertiary"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text">
                    {project.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-text-tertiary">
                    {project.path}
                  </div>
                </div>
              </button>
              <button
                onClick={() => setProjectToDelete(project)}
                className="shrink-0 rounded-md p-1.5 text-text-tertiary opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
                title="Delete project"
                aria-label={`Delete project ${project.name}`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {projectToDelete && (
        <DeleteProjectModal
          project={projectToDelete}
          deleting={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (deleting) return;
            setProjectToDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteProjectModal({
  project,
  deleting,
  error,
  onConfirm,
  onCancel,
}: {
  project: Project;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-base font-semibold text-text">
          Delete project
        </h2>
        <p className="mb-4 text-xs text-text-tertiary">
          This action cannot be undone.
        </p>

        <p className="mb-2 text-sm text-text">
          Delete <span className="font-medium">{project.name}</span> and its
          folder?
        </p>
        <div className="mb-4 rounded-md bg-surface px-3 py-2 font-mono text-xs text-text-secondary break-all">
          {project.path}
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-400 whitespace-pre-wrap break-words">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md px-4 py-1.5 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
