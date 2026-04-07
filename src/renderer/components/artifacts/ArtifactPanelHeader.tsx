import { useArtifactStore } from "../../stores/artifact-store";
import type { Artifact } from "../../stores/artifact-store";

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
  const removeArtifact = useArtifactStore((s) => s.removeArtifact);

  const active = activeId ? artifacts[activeId] : null;
  const artifactList = Object.values(artifacts);
  const showCodeToggle = active?.type === "html" || active?.type === "react";

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-3 py-2">
      {/* Artifact switcher dropdown */}
      {artifactList.length > 1 ? (
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveArtifact(e.target.value || null)}
          className="max-w-[180px] truncate rounded bg-surface px-2 py-1 text-xs text-text"
        >
          {artifactList.map((a) => (
            <option key={a.id} value={a.id}>
              {TYPE_LABELS[a.type] || a.type}: {a.title}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {active ? TYPE_LABELS[active.type] || active.type : ""}
          </span>
          <span className="truncate text-xs font-medium text-text">
            {active?.title ?? "Artifact"}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Code/Preview toggle */}
      {showCodeToggle && (
        <div className="flex rounded-md border border-border text-[10px]">
          <button
            onClick={() => setViewMode("preview")}
            className={`px-2 py-0.5 transition-colors ${
              viewMode === "preview"
                ? "bg-accent text-accent-text"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={`px-2 py-0.5 transition-colors ${
              viewMode === "code"
                ? "bg-accent text-accent-text"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            Code
          </button>
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => setPanelOpen(false)}
        className="rounded p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
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
