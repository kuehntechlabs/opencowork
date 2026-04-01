import { useState } from "react";
import {
  useProviderConfigStore,
  CLOUD_PROVIDERS,
  LOCAL_PRESETS,
  type LocalProviderEntry,
} from "../../stores/provider-config-store";
import { Spinner } from "../common/Spinner";

interface Props {
  onClose: () => void;
}

export function ProviderSettings({ onClose }: Props) {
  const {
    providers,
    saving,
    saveAndRestart,
    setCloudProvider,
    setLocalProvider,
    removeProvider,
  } = useProviderConfigStore();

  const [addCloudId, setAddCloudId] = useState("");
  const [addLocalId, setAddLocalId] = useState("");

  const configuredCloudIds = Object.keys(providers).filter(
    (id) => providers[id].kind === "cloud",
  );
  const configuredLocalIds = Object.keys(providers).filter(
    (id) => providers[id].kind === "local",
  );

  const availableCloud = CLOUD_PROVIDERS.filter(
    (p) => !configuredCloudIds.includes(p.id),
  );

  const handleSave = async () => {
    await saveAndRestart();
    onClose();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cloud Providers */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase">
          Cloud Providers
        </h3>
        <div className="flex flex-col gap-2">
          {configuredCloudIds.map((id) => {
            const entry = providers[id];
            if (entry.kind !== "cloud") return null;
            const meta = CLOUD_PROVIDERS.find((p) => p.id === id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary p-3"
              >
                <span className="w-24 shrink-0 text-sm font-medium text-text">
                  {meta?.name || id}
                </span>
                <input
                  type="password"
                  value={entry.apiKey}
                  onChange={(e) => setCloudProvider(id, e.target.value)}
                  placeholder={meta?.placeholder || "API key"}
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => removeProvider(id)}
                  className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-red-400"
                  title="Remove"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}

          {availableCloud.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={addCloudId}
                onChange={(e) => setAddCloudId(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="">Add cloud provider...</option>
                {availableCloud.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {addCloudId && (
                <button
                  onClick={() => {
                    setCloudProvider(addCloudId, "");
                    setAddCloudId("");
                  }}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-text hover:bg-accent/80"
                >
                  Add
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Local Providers */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase">
          Local Providers
        </h3>
        <div className="flex flex-col gap-3">
          {configuredLocalIds.map((id) => {
            const entry = providers[id] as LocalProviderEntry;
            return (
              <div
                key={id}
                className="rounded-lg border border-border bg-surface-secondary p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-text">
                    {entry.name || id}
                  </span>
                  <button
                    onClick={() => removeProvider(id)}
                    className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-red-400"
                    title="Remove"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-2 flex flex-col gap-1.5">
                  <label className="text-xs text-text-tertiary">Base URL</label>
                  <input
                    type="text"
                    value={entry.baseURL}
                    onChange={(e) =>
                      setLocalProvider(id, {
                        ...entry,
                        baseURL: e.target.value,
                      })
                    }
                    placeholder="http://localhost:11434/v1"
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-tertiary">Models</label>
                  {Object.entries(entry.models).map(([modelId, model]) => (
                    <div key={modelId} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={modelId}
                        readOnly
                        className="w-1/3 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary"
                      />
                      <input
                        type="text"
                        value={model.name}
                        onChange={(e) => {
                          const models = {
                            ...entry.models,
                            [modelId]: { name: e.target.value },
                          };
                          setLocalProvider(id, { ...entry, models });
                        }}
                        className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                        placeholder="Display name"
                      />
                      <button
                        onClick={() => {
                          const { [modelId]: _, ...rest } = entry.models;
                          setLocalProvider(id, { ...entry, models: rest });
                        }}
                        className="rounded p-0.5 text-text-tertiary hover:text-red-400"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <AddModelRow
                    onAdd={(modelId, modelName) => {
                      const models = {
                        ...entry.models,
                        [modelId]: { name: modelName },
                      };
                      setLocalProvider(id, { ...entry, models });
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Add local provider */}
          <div className="flex items-center gap-2">
            <select
              value={addLocalId}
              onChange={(e) => setAddLocalId(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="">Add local provider...</option>
              {LOCAL_PRESETS.filter(
                (p) => !configuredLocalIds.includes(p.id),
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__custom">Custom...</option>
            </select>
            {addLocalId && (
              <button
                onClick={() => {
                  const preset = LOCAL_PRESETS.find((p) => p.id === addLocalId);
                  if (preset) {
                    setLocalProvider(preset.id, {
                      name: preset.name,
                      npm: preset.npm,
                      baseURL: preset.baseURL,
                      models: {},
                    });
                  } else {
                    setLocalProvider("custom", {
                      name: "Custom",
                      npm: "@ai-sdk/openai-compatible",
                      baseURL: "http://localhost:8080/v1",
                      models: {},
                    });
                  }
                  setAddLocalId("");
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-text hover:bg-accent/80"
              >
                Add
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm text-accent-text hover:bg-accent/80 disabled:opacity-50"
        >
          {saving && <Spinner size={14} />}
          {saving ? "Saving..." : "Save & Restart"}
        </button>
      </div>
    </div>
  );
}

function AddModelRow({ onAdd }: { onAdd: (id: string, name: string) => void }) {
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        placeholder="model-id"
        className="w-1/3 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
      />
      <input
        type="text"
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        placeholder="Display name"
        className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
      />
      <button
        onClick={() => {
          if (modelId.trim()) {
            onAdd(modelId.trim(), modelName.trim() || modelId.trim());
            setModelId("");
            setModelName("");
          }
        }}
        disabled={!modelId.trim()}
        className="rounded px-2 py-1 text-xs text-accent hover:bg-surface-hover disabled:opacity-30"
      >
        + Add
      </button>
    </div>
  );
}
