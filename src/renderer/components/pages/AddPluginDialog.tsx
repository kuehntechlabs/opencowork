import { useCallback, useState } from "react";
import type {
  PluginSourceDescriptor,
  PluginComponents,
  InstalledPlugin,
  ElectronAPI,
} from "../../../preload/index";

type SourceTab = "github" | "url" | "local";

const api = (window as unknown as { api: ElectronAPI }).api;

interface Props {
  onClose: () => void;
  onSuccess: (plugin: InstalledPlugin, inventory: PluginComponents) => void;
}

export function AddPluginDialog({ onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<SourceTab>("github");

  // github shorthand or full URL + optional ref
  const [ghRepo, setGhRepo] = useState("");
  const [ghRef, setGhRef] = useState("");

  // full git URL + optional ref
  const [gitUrl, setGitUrl] = useState("");
  const [gitRef, setGitRef] = useState("");

  // local folder path
  const [localPath, setLocalPath] = useState("");

  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFolder = useCallback(async () => {
    const p = await api.pickPluginFolder();
    if (p) setLocalPath(p);
  }, []);

  const handleInstall = useCallback(async () => {
    setError(null);
    let source: PluginSourceDescriptor | null = null;

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

    setInstalling(true);
    try {
      const result = await api.installPlugin(source);
      if (result.ok) {
        onSuccess(result.plugin, result.inventory);
      } else {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }, [tab, ghRepo, ghRef, gitUrl, gitRef, localPath, onSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Install plugin</h2>
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

        {/* Tab content */}
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
                placeholder="anthropics/skills  or  https://github.com/owner/repo"
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
                placeholder="https://gitlab.com/team/plugin.git"
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
                  placeholder="/path/to/plugin"
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
            <p className="text-[11px] leading-relaxed text-text-tertiary">
              The folder must contain{" "}
              <code className="text-accent">.claude-plugin/plugin.json</code> or{" "}
              <code className="text-accent">.codex-plugin/plugin.json</code>.
              Skills are copied into your skills library on install.
            </p>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">
          Only install plugins from developers you trust. Plugins can add
          skills, MCP servers, and other components that run in your sessions.
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
            onClick={handleInstall}
            disabled={installing}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {installing ? "Installing…" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
