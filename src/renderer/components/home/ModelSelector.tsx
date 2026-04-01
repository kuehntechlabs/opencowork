import { useState, useEffect } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { listProviders } from "../../api/client";
import type { Provider } from "../../api/types";
import { useServerStore } from "../../stores/server-store";

export function ModelSelector() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [open, setOpen] = useState(false);
  const { selectedProvider, selectedModel, setSelectedModel } =
    useSettingsStore();
  const connected = useServerStore((s) => s.connected);
  const directory = useServerStore((s) => s.directory);

  useEffect(() => {
    if (!connected) return;
    listProviders(directory || undefined)
      .then((res) => setProviders(res.all ?? []))
      .catch(() => {});
  }, [connected, directory]);

  const currentLabel =
    selectedProvider && selectedModel
      ? `${selectedProvider}/${selectedModel}`
      : "Select model";

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
        <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-72 overflow-y-auto rounded-lg border border-border bg-surface-secondary shadow-lg">
          {providers.length === 0 ? (
            <div className="p-3 text-sm text-text-tertiary">
              No providers available
            </div>
          ) : (
            providers.map((provider) => {
              const models = provider.models
                ? Object.values(provider.models)
                : [];
              return (
                <div key={provider.id}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-text-tertiary uppercase">
                    {provider.name || provider.id}
                  </div>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(provider.id, model.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-hover ${
                        selectedProvider === provider.id &&
                        selectedModel === model.id
                          ? "text-accent"
                          : "text-text"
                      }`}
                    >
                      {model.name || model.id}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
