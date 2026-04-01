import { useState, useEffect } from "react";
import { useProjectStore } from "../../stores/project-store";
import { useServerStore } from "../../stores/server-store";

export function NewProjectModal() {
  const open = useProjectStore((s) => s.newProjectModalOpen);
  const close = () => useProjectStore.getState().setNewProjectModalOpen(false);
  const createProject = useProjectStore((s) => s.createProject);
  const setDirectory = useServerStore((s) => s.setDirectory);
  const addRecentDirectory = useProjectStore((s) => s.addRecentDirectory);

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Reset form
    setName("");
    setInstructions("");
    setFilePaths([]);
    setError(null);

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  const handleAddFiles = async () => {
    const paths = await window.api.openFilePicker();
    if (paths.length) {
      setFilePaths((prev) => [
        ...prev,
        ...paths.filter((p) => !prev.includes(p)),
      ]);
    }
  };

  const handleRemoveFile = (path: string) => {
    setFilePaths((prev) => prev.filter((p) => p !== path));
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    // Sanitize: only allow alphanumeric, hyphens, underscores, spaces
    if (!/^[\w\s-]+$/.test(trimmed)) {
      setError("Name can only contain letters, numbers, spaces, and hyphens");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: trimmed,
        instructions: instructions.trim() || undefined,
        filePaths: filePaths.length > 0 ? filePaths : undefined,
      });
      setDirectory(project.path);
      addRecentDirectory(project.path);
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        {/* Back / title */}
        <button
          onClick={close}
          className="mb-4 rounded-md p-1 text-text-tertiary hover:text-text"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2 className="mb-5 text-lg font-semibold text-text">
          Start new project
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
        </div>

        {/* Instructions */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Tell the AI how it should work in this project (optional)"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
        </div>

        {/* Files */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Add files
          </label>
          <button
            onClick={handleAddFiles}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-secondary px-3 py-3 text-xs text-text-tertiary transition-colors hover:border-accent hover:text-text"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Click to browse files
          </button>
          {filePaths.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {filePaths.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 rounded-md bg-surface-secondary px-2 py-1 text-xs text-text"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {p.split("/").pop()}
                  </span>
                  <button
                    onClick={() => handleRemoveFile(p)}
                    className="shrink-0 text-text-tertiary hover:text-red-400"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={close}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-text transition-colors hover:bg-accent/80 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
