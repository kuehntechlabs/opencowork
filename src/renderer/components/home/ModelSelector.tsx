import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { listProviders } from "../../api/client";
import type { Provider, Model } from "../../api/types";
import { useServerStore } from "../../stores/server-store";

const openSettings = () =>
  useSettingsStore.getState().setSettingsModalOpen(true);

function isFree(model: Model): boolean {
  return !model.cost || (model.cost.input === 0 && model.cost.output === 0);
}

export function ModelSelector() {
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { selectedProvider, selectedModel, setSelectedModel } =
    useSettingsStore();
  const connected = useServerStore((s) => s.connected);
  const directory = useServerStore((s) => s.directory);

  useEffect(() => {
    if (!connected) return;
    listProviders()
      .then((res) => {
        setAllProviders(res.all ?? []);
        setConnectedIds(res.connected ?? []);
      })
      .catch(() => {});
  }, [connected, directory]);

  // Only show connected providers (ones with valid auth)
  const connectedProviders = useMemo(() => {
    return allProviders.filter((p) => connectedIds.includes(p.id));
  }, [allProviders, connectedIds]);

  // Filter models by search
  const filteredProviders = useMemo(() => {
    if (!search.trim()) return connectedProviders;
    const q = search.toLowerCase();
    return connectedProviders
      .map((p) => {
        const models: Record<string, Model> = {};
        for (const [id, m] of Object.entries(p.models ?? {})) {
          if (
            m.name?.toLowerCase().includes(q) ||
            id.toLowerCase().includes(q) ||
            p.name?.toLowerCase().includes(q)
          ) {
            models[id] = m;
          }
        }
        return { ...p, models };
      })
      .filter((p) => Object.keys(p.models).length > 0);
  }, [connectedProviders, search]);

  const currentLabel =
    selectedProvider && selectedModel ? `${selectedModel}` : "Select model";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
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
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="text-text">{currentLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-text-tertiary"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-lg border border-border bg-surface-secondary shadow-lg">
          {/* Search */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              autoFocus
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>

          {/* Model list */}
          <div className="max-h-72 overflow-y-auto">
            {filteredProviders.length === 0 ? (
              <div className="flex flex-col gap-2 p-3">
                <span className="text-sm text-text-tertiary">
                  {connectedProviders.length === 0
                    ? "No providers connected"
                    : "No matching models"}
                </span>
                {connectedProviders.length === 0 && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      openSettings();
                    }}
                    className="text-left text-sm text-accent hover:underline"
                  >
                    Configure providers...
                  </button>
                )}
              </div>
            ) : (
              filteredProviders.map((provider) => {
                const models = Object.values(provider.models ?? {});
                if (models.length === 0) return null;
                return (
                  <div key={provider.id}>
                    <div className="sticky top-0 bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-accent">
                      {provider.name || provider.id}
                    </div>
                    {models.map((model) => {
                      const isSelected =
                        selectedProvider === provider.id &&
                        selectedModel === model.id;
                      const free = isFree(model);
                      return (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(provider.id, model.id);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${
                            isSelected ? "text-accent" : "text-text"
                          }`}
                        >
                          {isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          )}
                          <span className="flex-1 truncate text-left">
                            {model.name || model.id}
                          </span>
                          {free && (
                            <span className="shrink-0 text-[10px] font-medium text-green-400">
                              Free
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-text-tertiary">
            <button
              onClick={() => {
                setOpen(false);
                openSettings();
              }}
              className="hover:text-text"
            >
              Connect provider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
