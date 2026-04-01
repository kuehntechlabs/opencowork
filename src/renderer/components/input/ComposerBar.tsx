import { useState, useEffect, useMemo, useRef } from "react";
import {
  useSettingsStore,
  type PermissionMode,
} from "../../stores/settings-store";
import { useServerStore } from "../../stores/server-store";
import { listProviders } from "../../api/client";
import type { Provider, Model } from "../../api/types";

const openSettings = () =>
  useSettingsStore.getState().setSettingsModalOpen(true);

function isFree(model: Model): boolean {
  return !model.cost || (model.cost.input === 0 && model.cost.output === 0);
}

const MODES: {
  value: PermissionMode;
  label: string;
  description: string;
  icon: "chat" | "check" | "plan" | "warning";
}[] = [
  {
    value: "ask",
    label: "Ask permission",
    description: "Always ask before making changes",
    icon: "chat",
  },
  {
    value: "auto-accept",
    label: "Auto-accept changes",
    description: "Auto-accept all file edits",
    icon: "check",
  },
  {
    value: "plan",
    label: "Plan mode",
    description: "Create a plan before you make changes",
    icon: "plan",
  },
  {
    value: "bypass",
    label: "Bypass permissions",
    description: "Accepts all permissions",
    icon: "warning",
  },
];

function ModeIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case "chat":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "check":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11.5 14.5 15 10" />
        </svg>
      );
    case "plan":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "warning":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return null;
  }
}

export function ComposerBar() {
  const { permissionMode, setPermissionMode, selectedProvider, selectedModel } =
    useSettingsStore();
  const connected = useServerStore((s) => s.connected);
  const directory = useServerStore((s) => s.directory);

  const [modeOpen, setModeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);

  const modeRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node))
        setModeOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false);
        setModelSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!connected) return;
    listProviders()
      .then((res) => {
        setAllProviders(res.all ?? []);
        setConnectedIds(res.connected ?? []);
      })
      .catch(() => {});
  }, [connected, directory]);

  const connectedProviders = useMemo(
    () => allProviders.filter((p) => connectedIds.includes(p.id)),
    [allProviders, connectedIds],
  );

  const filteredProviders = useMemo(() => {
    if (!modelSearch.trim()) return connectedProviders;
    const q = modelSearch.toLowerCase();
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
  }, [connectedProviders, modelSearch]);

  const currentMode =
    MODES.find((m) => m.value === permissionMode) ?? MODES[0];

  const modelLabel = selectedModel || "Model";
  const folderName = directory?.split("/").pop() || "";

  return (
    <div className="flex flex-col gap-1">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        {/* Left: mode dropdown */}
        <div ref={modeRef} className="relative">
          <button
            onClick={() => {
              setModeOpen(!modeOpen);
              setModelOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ModeIcon icon={currentMode.icon} />
            {currentMode.label}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {modeOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border border-border bg-surface-secondary py-1 shadow-lg">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => {
                    setPermissionMode(mode.value);
                    setModeOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-hover ${
                    permissionMode === mode.value
                      ? "text-accent"
                      : "text-text"
                  }`}
                >
                  <ModeIcon
                    icon={mode.icon}
                    className="shrink-0 opacity-60"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{mode.label}</div>
                    <div className="text-[11px] text-text-tertiary">
                      {mode.description}
                    </div>
                  </div>
                  {permissionMode === mode.value && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="shrink-0 text-accent"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: model selector */}
        <div ref={modelRef} className="relative">
          <button
            onClick={() => {
              setModelOpen(!modelOpen);
              setModeOpen(false);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            {modelLabel}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {modelOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-1 w-72 rounded-lg border border-border bg-surface-secondary shadow-lg">
              <div className="border-b border-border/30 p-2">
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models..."
                  autoFocus
                  className="w-full bg-transparent px-2 py-1 text-xs text-text placeholder:text-text-tertiary focus:outline-none"
                />
              </div>

              <div className="max-h-60 overflow-y-auto">
                {filteredProviders.length === 0 ? (
                  <div className="flex flex-col gap-1 p-3">
                    <span className="text-xs text-text-tertiary">
                      {connectedProviders.length === 0
                        ? "No providers connected"
                        : "No matching models"}
                    </span>
                    {connectedProviders.length === 0 && (
                      <button
                        onClick={() => {
                          setModelOpen(false);
                          openSettings();
                        }}
                        className="text-left text-xs text-accent hover:underline"
                      >
                        Connect provider...
                      </button>
                    )}
                  </div>
                ) : (
                  filteredProviders.map((provider) => {
                    const models = Object.values(provider.models ?? {});
                    if (models.length === 0) return null;
                    return (
                      <div key={provider.id}>
                        <div className="sticky top-0 bg-surface-secondary px-3 py-1 text-[10px] font-semibold text-accent">
                          {provider.name || provider.id}
                        </div>
                        {models.map((model) => {
                          const isSelected =
                            selectedProvider === provider.id &&
                            selectedModel === model.id;
                          return (
                            <button
                              key={model.id}
                              onClick={() => {
                                useSettingsStore
                                  .getState()
                                  .setSelectedModel(provider.id, model.id);
                                setModelOpen(false);
                                setModelSearch("");
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-1 text-xs transition-colors hover:bg-surface-hover ${
                                isSelected ? "text-accent" : "text-text"
                              }`}
                            >
                              {isSelected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                              )}
                              <span className="flex-1 truncate text-left">
                                {model.name || model.id}
                              </span>
                              {isFree(model) && (
                                <span className="text-[10px] text-green-400">
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

              <div className="border-t border-border/30 px-3 py-1.5">
                <button
                  onClick={() => {
                    setModelOpen(false);
                    openSettings();
                  }}
                  className="text-[10px] text-text-tertiary hover:text-text"
                >
                  Connect provider
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info row: folder */}
      {directory && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="truncate">{folderName}</span>
        </div>
      )}
    </div>
  );
}

/** Returns current selected agent name for use by parent components */
export function useCurrentAgent(): string {
  const permissionMode = useSettingsStore((s) => s.permissionMode);
  return permissionMode === "plan" ? "plan" : "build";
}
