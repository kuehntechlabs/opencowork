import { useCallback, useState } from "react";
import type {
  Marketplace,
  MarketplaceSourceDescriptor,
  ElectronAPI,
} from "../../../preload/index";

type SourceTab = "github" | "url" | "local";

const api = (window as unknown as { api: ElectronAPI }).api;

interface Props {
  onClose: () => void;
  onSuccess: (marketplace: Marketplace) => void;
}

export function AddMarketplaceDialog({ onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<SourceTab>("github");

  const [ghRepo, setGhRepo] = useState("");
  const [ghRef, setGhRef] = useState("");

  const [gitUrl, setGitUrl] = useState("");
  const [gitRef, setGitRef] = useState("");

  const [localPath, setLocalPath] = useState("");

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFolder = useCallback(async () => {
    const p = await api.pickPluginFolder();
    if (p) setLocalPath(p);
  }, []);

  const handleAdd = useCallback(async () => {
    setError(null);
    let source: MarketplaceSourceDescriptor | null = null;

    if (tab === "github") {
      const repo = ghRepo.trim();
      if (!repo) {
        setError("Enter a GitHub repository (owner/repo or full URL).");
        return;
      }
      source = { type: "github", repo, ref: ghRef.trim() || undefined };
    } else if (tab === "url") {
      const url = gitUrl.trim();
      if (!url) {
        setError("Enter a git repository URL.");
        return;
      }
      source = { type: "url", url, ref: gitRef.trim() || undefined };
    } else {
      const path = localPath.trim();
      if (!path) {
        setError("Pick a local folder.");
        return;
      }
      source = { type: "local", path };
    }

    setAdding(true);
    try {
      const result = await api.addMarketplace(source);
      if (result.ok) {
        onSuccess(result.marketplace);
      } else {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Adding marketplace failed");
    } finally {
      setAdding(false);
    }
  }, [tab, ghRepo, ghRef, gitUrl, gitRef, localPath, onSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">
              Add marketplace
            </h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              A marketplace is a catalog of plugins you can install from.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="16"
              height="16"
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

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-md bg-surface p-1">
          {(
            [
              { key: "github", label: "GitHub" },
              { key: "url", label: "Git URL" },
              { key: "local", label: "Local folder" },
            ] as { key: SourceTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent/10 text-accent"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "github" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Repository
              </label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="anthropics/claude-code-plugins  or  https://github.com/owner/repo"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Branch or tag (optional)
              </label>
              <input
                type="text"
                value={ghRef}
                onChange={(e) => setGhRef(e.target.value)}
                placeholder="main"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {tab === "url" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Git URL
              </label>
              <input
                type="text"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://gitlab.com/team/marketplace.git"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Branch or tag (optional)
              </label>
              <input
                type="text"
                value={gitRef}
                onChange={(e) => setGitRef(e.target.value)}
                placeholder="main"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {tab === "local" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Folder path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/path/to/marketplace"
                  className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
                <button
                  onClick={pickFolder}
                  className="shrink-0 rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover hover:text-text"
                >
                  Browse…
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">
          The folder or repo must contain{" "}
          <code className="text-accent">.claude-plugin/marketplace.json</code>{" "}
          or the Codex equivalent. Plugins listed in the marketplace are shown
          here — you install them individually.
        </p>

        {error && (
          <p className="mt-3 whitespace-pre-wrap break-words text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add marketplace"}
          </button>
        </div>
      </div>
    </div>
  );
}
