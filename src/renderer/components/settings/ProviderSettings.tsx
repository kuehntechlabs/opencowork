import { useState, useEffect, useMemo } from "react";
import { useSettingsStore, type Theme } from "../../stores/settings-store";
import { listProviders, getBaseUrl } from "../../api/client";
import type { Provider } from "../../api/types";
import { useServerStore } from "../../stores/server-store";
import { Spinner } from "../common/Spinner";

interface AuthMethod {
  type: "oauth" | "api";
  label: string;
  prompts?: Array<{
    type: "text" | "select";
    key: string;
    message: string;
    placeholder?: string;
    options?: Array<{ label: string; value: string; hint?: string }>;
    when?: { key: string; op: "eq" | "neq"; value: string };
  }>;
}

const POPULAR_IDS = [
  "opencode",
  "opencode-go",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
];
const popularSet = new Set(POPULAR_IDS);

interface Props {
  onClose: () => void;
}

export function ProviderSettings({ onClose }: Props) {
  const { theme, setTheme } = useSettingsStore();
  const connected = useServerStore((s) => s.connected);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [authMethods, setAuthMethods] = useState<Record<string, AuthMethod[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  // Connect provider flow
  const [showConnect, setShowConnect] = useState(false);
  const [connectSearch, setConnectSearch] = useState("");
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );
  const [authInputs, setAuthInputs] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    if (!connected) return;
    setLoading(true);
    Promise.all([
      listProviders(),
      fetch(`${getBaseUrl()}/provider/auth`).then((r) => r.json()),
    ])
      .then(([providerRes, authRes]) => {
        setProviders(providerRes.all ?? []);
        setConnectedIds(providerRes.connected ?? []);
        setAuthMethods(authRes ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [connected]);

  // All providers that aren't connected yet, sorted popular first
  const availableProviders = useMemo(() => {
    const connSet = new Set(connectedIds);
    const available = providers.filter((p) => !connSet.has(p.id));
    const q = connectSearch.toLowerCase();
    const filtered = q
      ? available.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
        )
      : available;

    const popular = filtered.filter((p) => popularSet.has(p.id));
    const other = filtered.filter((p) => !popularSet.has(p.id));
    // Sort popular by POPULAR_IDS order
    popular.sort(
      (a, b) => POPULAR_IDS.indexOf(a.id) - POPULAR_IDS.indexOf(b.id),
    );
    other.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    return { popular, other };
  }, [providers, connectedIds, connectSearch]);

  const handleConnect = async (providerId: string, methodIndex: number) => {
    setSaving(true);
    setAuthError(null);
    try {
      const res = await fetch(
        `${getBaseUrl()}/provider/${providerId}/oauth/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: methodIndex, inputs: authInputs }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank");

      // Refresh
      refresh();
      setConnectingProvider(null);
      setAuthInputs({});
      setShowConnect(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await fetch(`${getBaseUrl()}/auth/${providerId}`, { method: "DELETE" });
      setConnectedIds((ids) => ids.filter((id) => id !== providerId));
    } catch {
      // ignore
    }
  };

  const themes: { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Theme */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase text-text-secondary">
          Theme
        </h3>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-secondary p-1">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === t.value
                  ? "bg-surface-tertiary text-text"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Connected Providers */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-text-secondary">
            Connected Providers
          </h3>
          {!showConnect && (
            <button
              onClick={() => setShowConnect(true)}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Connect provider
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Spinner size={14} />
            <span className="text-sm text-text-tertiary">Loading...</span>
          </div>
        ) : connectedIds.length === 0 ? (
          <p className="py-2 text-sm text-text-tertiary">
            No providers connected
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {connectedIds.map((id) => {
              const provider = providers.find((p) => p.id === id);
              const modelCount = provider
                ? Object.keys(provider.models ?? {}).length
                : 0;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2.5"
                >
                  <div>
                    <span className="text-sm font-medium text-text">
                      {provider?.name || id}
                    </span>
                    <span className="ml-2 text-xs text-text-tertiary">
                      {modelCount} models
                    </span>
                  </div>
                  <button
                    onClick={() => handleDisconnect(id)}
                    className="rounded-md px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Connect Provider Panel */}
      {showConnect && (
        <section className="rounded-lg border border-border bg-surface-secondary">
          {connectingProvider ? (
            <ConnectForm
              providerId={connectingProvider}
              providerName={
                providers.find((p) => p.id === connectingProvider)?.name ??
                connectingProvider
              }
              methods={authMethods[connectingProvider] ?? []}
              inputs={authInputs}
              setInputs={setAuthInputs}
              error={authError}
              saving={saving}
              onConnect={handleConnect}
              onCancel={() => {
                setConnectingProvider(null);
                setAuthInputs({});
                setAuthError(null);
              }}
            />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium text-text">
                  Connect a provider
                </span>
                <button
                  onClick={() => {
                    setShowConnect(false);
                    setConnectSearch("");
                  }}
                  className="text-xs text-text-tertiary hover:text-text"
                >
                  esc
                </button>
              </div>

              {/* Search */}
              <div className="border-b border-border px-3 py-2">
                <input
                  type="text"
                  value={connectSearch}
                  onChange={(e) => setConnectSearch(e.target.value)}
                  placeholder="Search"
                  autoFocus
                  className="w-full bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
                />
              </div>

              {/* Provider list */}
              <div className="max-h-64 overflow-y-auto">
                {availableProviders.popular.length > 0 && (
                  <>
                    <div className="sticky top-0 bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-accent">
                      Popular
                    </div>
                    {availableProviders.popular.map((p) => (
                      <ProviderRow
                        key={p.id}
                        provider={p}
                        hasAuth={!!authMethods[p.id]?.length}
                        onClick={() => {
                          if (authMethods[p.id]?.length) {
                            setConnectingProvider(p.id);
                          }
                        }}
                      />
                    ))}
                  </>
                )}
                {availableProviders.other.length > 0 && (
                  <>
                    <div className="sticky top-0 bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-accent">
                      Other
                    </div>
                    {availableProviders.other.map((p) => (
                      <ProviderRow
                        key={p.id}
                        provider={p}
                        hasAuth={!!authMethods[p.id]?.length}
                        onClick={() => {
                          if (authMethods[p.id]?.length) {
                            setConnectingProvider(p.id);
                          }
                        }}
                      />
                    ))}
                  </>
                )}
                {availableProviders.popular.length === 0 &&
                  availableProviders.other.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-text-tertiary">
                      No matching providers
                    </div>
                  )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Close */}
      <div className="flex justify-end border-t border-border pt-4">
        <button
          onClick={onClose}
          className="rounded-md bg-accent px-4 py-2 text-sm text-accent-text hover:bg-accent/80"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  hasAuth,
  onClick,
}: {
  provider: Provider;
  hasAuth: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!hasAuth}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        hasAuth
          ? "text-text hover:bg-surface-hover"
          : "cursor-default text-text-tertiary"
      }`}
    >
      <span className="flex-1">{provider.name || provider.id}</span>
      {!hasAuth && (
        <span className="text-[10px] text-text-tertiary">env var</span>
      )}
    </button>
  );
}

function ConnectForm({
  providerId,
  providerName,
  methods,
  inputs,
  setInputs,
  error,
  saving,
  onConnect,
  onCancel,
}: {
  providerId: string;
  providerName: string;
  methods: AuthMethod[];
  inputs: Record<string, string>;
  setInputs: (inputs: Record<string, string>) => void;
  error: string | null;
  saving: boolean;
  onConnect: (providerId: string, methodIndex: number) => void;
  onCancel: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState(0);
  const method = methods[selectedMethod];
  if (!method) return null;

  // Filter prompts by `when` conditions
  const visiblePrompts = (method.prompts ?? []).filter((prompt) => {
    if (!prompt.when) return true;
    const val = inputs[prompt.when.key];
    if (prompt.when.op === "eq") return val === prompt.when.value;
    if (prompt.when.op === "neq") return val !== prompt.when.value;
    return true;
  });

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-text">{providerName}</h4>
        <button
          onClick={onCancel}
          className="text-xs text-text-tertiary hover:text-text"
        >
          Back
        </button>
      </div>

      {/* Method tabs if multiple */}
      {methods.length > 1 && (
        <div className="mb-3 flex gap-1 rounded-md border border-border bg-surface p-0.5">
          {methods.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedMethod(i);
                setInputs({});
              }}
              className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                selectedMethod === i
                  ? "bg-surface-tertiary text-text"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Single method label */}
      {methods.length === 1 && (
        <p className="mb-3 text-xs text-text-tertiary">{method.label}</p>
      )}

      {/* Prompts */}
      {visiblePrompts.map((prompt) => (
        <div key={prompt.key} className="mb-3">
          <label className="mb-1 block text-xs text-text-tertiary">
            {prompt.message}
          </label>
          {prompt.type === "select" ? (
            <select
              value={inputs[prompt.key] ?? ""}
              onChange={(e) =>
                setInputs({ ...inputs, [prompt.key]: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option value="">Select...</option>
              {prompt.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.hint ? ` (${opt.hint})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={
                prompt.key.includes("key") ||
                prompt.key.includes("secret") ||
                prompt.key.includes("token")
                  ? "password"
                  : "text"
              }
              value={inputs[prompt.key] ?? ""}
              onChange={(e) =>
                setInputs({ ...inputs, [prompt.key]: e.target.value })
              }
              placeholder={prompt.placeholder || ""}
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          )}
        </div>
      ))}

      {/* No prompts = OAuth or simple connect */}
      {visiblePrompts.length === 0 && (
        <p className="mb-3 text-xs text-text-tertiary">
          {method.type === "oauth"
            ? "Click connect to authenticate via browser"
            : "Click connect to set up this provider"}
        </p>
      )}

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <button
        onClick={() => onConnect(providerId, selectedMethod)}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm text-accent-text hover:bg-accent/80 disabled:opacity-50"
      >
        {saving && <Spinner size={14} />}
        {saving ? "Connecting..." : "Connect"}
      </button>
    </div>
  );
}
