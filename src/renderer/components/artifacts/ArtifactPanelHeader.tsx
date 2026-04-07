import { useArtifactStore } from "../../stores/artifact-store";

const TYPE_LABELS: Record<string, string> = {
  html: "HTML",
  react: "React",
  notebook: "Notebook",
  browser: "Browser",
};

export function ArtifactPanelHeader() {
  const activeId = useArtifactStore((s) => s.activeArtifactId);
  const artifacts = useArtifactStore((s) => s.artifacts);
  const viewMode = useArtifactStore((s) => s.viewMode);
  const setViewMode = useArtifactStore((s) => s.setViewMode);
  const setActiveArtifact = useArtifactStore((s) => s.setActiveArtifact);
  const setPanelOpen = useArtifactStore((s) => s.setPanelOpen);

  const active = activeId ? artifacts[activeId] : null;
  const artifactList = Object.values(artifacts);
  const showCodeToggle = active?.type === "html" || active?.type === "react";

  return (
    <div className="flex min-w-0 items-center gap-1.5 border-b border-border bg-surface-secondary px-2 py-1.5">
      {/* Title / Switcher — truncates on small screens */}
      <div className="min-w-0 flex-1">
        {artifactList.length > 1 ? (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveArtifact(e.target.value || null)}
            className="w-full truncate rounded bg-surface px-1.5 py-0.5 text-xs text-text"
          >
            {artifactList.map((a) => (
              <option key={a.id} value={a.id}>
                {TYPE_LABELS[a.type] || a.type}: {a.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="shrink-0 rounded bg-accent/10 px-1 py-0.5 text-[9px] font-medium text-accent">
              {active ? TYPE_LABELS[active.type] || active.type : ""}
            </span>
            <span className="truncate text-xs font-medium text-text">
              {active?.title ?? "Artifact"}
            </span>
          </div>
        )}
      </div>

      {/* Code/Preview toggle — compact, never wraps */}
      {showCodeToggle && (
        <div className="flex shrink-0 rounded border border-border text-[10px]">
          <button
            onClick={() => setViewMode("preview")}
            className={`px-1.5 py-0.5 transition-colors ${
              viewMode === "preview"
                ? "bg-accent text-accent-text"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={`px-1.5 py-0.5 transition-colors ${
              viewMode === "code"
                ? "bg-accent text-accent-text"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            Code
          </button>
        </div>
      )}

      {/* Close — always visible */}
      <button
        onClick={() => setPanelOpen(false)}
        className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
        title="Close panel"
      >
        <svg
          width="14"
          height="14"
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
  );
}
