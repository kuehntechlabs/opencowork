import { useServerStore } from "../../stores/server-store";

export function FolderPicker() {
  const directory = useServerStore((s) => s.directory);
  const setDirectory = useServerStore((s) => s.setDirectory);

  const handlePick = async () => {
    const path = await window.api.openDirectoryPicker();
    if (path) setDirectory(path);
  };

  return (
    <button
      onClick={handlePick}
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
      <span className="text-text-secondary">
        {directory ? (
          <span className="text-text">
            {directory.split("/").pop() || directory}
          </span>
        ) : (
          "Choose working directory"
        )}
      </span>
      {directory && (
        <span className="ml-1 text-xs text-text-tertiary">{directory}</span>
      )}
    </button>
  );
}
