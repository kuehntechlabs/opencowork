import { useState } from "react";
import type {
  InstalledPlugin,
  Marketplace,
  MarketplacePluginEntry,
  MarketplacePluginInspection,
  PluginComponents,
  PluginManifest,
  PluginFormat,
} from "../../../preload/index";

// ── Left panel: sectioned list ─────────────────────────────────────

export function PluginsList({
  installedPlugins,
  marketplaces,
  loading,
  installingKeys,
  search,
  onSearchChange,
  selectedPlugin,
  onSelectPlugin,
  selectedMarketplacePluginKey,
  onSelectMarketplacePlugin,
  onInstallMarketplacePlugin,
  onRemoveMarketplace,
  onRefreshMarketplace,
}: {
  installedPlugins: InstalledPlugin[];
  marketplaces: Marketplace[];
  loading: boolean;
  installingKeys: Set<string>;
  search: string;
  onSearchChange: (v: string) => void;
  selectedPlugin: InstalledPlugin | null;
  onSelectPlugin: (p: InstalledPlugin) => void;
  selectedMarketplacePluginKey: string | null;
  onSelectMarketplacePlugin: (
    marketplaceName: string,
    pluginName: string,
  ) => void;
  onInstallMarketplacePlugin: (
    marketplaceName: string,
    pluginName: string,
  ) => void;
  onRemoveMarketplace: (name: string) => void;
  onRefreshMarketplace: (name: string) => void;
}) {
  const q = search.trim().toLowerCase();

  const installedNames = new Set(installedPlugins.map((p) => p.name));

  const filteredInstalled = q
    ? installedPlugins.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.manifest.description || "").toLowerCase().includes(q),
      )
    : installedPlugins;

  return (
    <div className="flex flex-col px-3 pb-4">
      {/* Search */}
      <div className="relative mb-3 px-1">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search plugins..."
          className="w-full rounded-md border border-border bg-surface-secondary py-1.5 pl-8 pr-3 text-xs text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      </div>

      {loading && marketplaces.length === 0 && installedPlugins.length === 0 ? (
        <p className="px-1 text-xs text-text-tertiary">Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Installed section */}
          <Section title="Installed" count={filteredInstalled.length}>
            {filteredInstalled.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-text-tertiary">
                {q
                  ? "No matching installed plugins."
                  : "No plugins installed yet."}
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredInstalled.map((plugin) => (
                  <InstalledRow
                    key={plugin.name}
                    plugin={plugin}
                    isSelected={selectedPlugin?.name === plugin.name}
                    onSelect={onSelectPlugin}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Marketplace sections */}
          {marketplaces.map((m) => (
            <MarketplaceSection
              key={m.name}
              marketplace={m}
              installedNames={installedNames}
              installingKeys={installingKeys}
              search={q}
              selectedKey={selectedMarketplacePluginKey}
              onSelect={onSelectMarketplacePlugin}
              onInstall={onInstallMarketplacePlugin}
              onRemove={onRemoveMarketplace}
              onRefresh={onRefreshMarketplace}
            />
          ))}

          {marketplaces.length === 0 && (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
              <p className="mb-1 text-xs text-text-secondary">
                No marketplaces yet.
              </p>
              <p className="text-[11px] text-text-tertiary">
                Add one to browse installable plugins.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────

function Section({
  title,
  count,
  right,
  children,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 px-1">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="truncate">{title}</span>
          {typeof count === "number" && (
            <span className="text-[10px] font-normal opacity-60">{count}</span>
          )}
        </button>
        {right}
      </div>
      {open && children}
    </div>
  );
}

// ── Installed plugin row ──────────────────────────────────────────

function InstalledRow({
  plugin,
  isSelected,
  onSelect,
}: {
  plugin: InstalledPlugin;
  isSelected: boolean;
  onSelect: (p: InstalledPlugin) => void;
}) {
  const totalComponents =
    plugin.components.skills +
    plugin.components.mcpServers +
    plugin.components.agents +
    plugin.components.commands +
    plugin.components.hooks +
    plugin.components.lsp +
    plugin.components.monitors;

  return (
    <button
      onClick={() => onSelect(plugin)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
        isSelected ? "bg-accent/10 text-accent" : "text-text hover:bg-surface-hover"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          isSelected
            ? "bg-accent/20 text-accent"
            : "bg-surface-tertiary text-text-tertiary"
        }`}
      >
        <PluginIcon />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm">{plugin.name}</span>
        <span className="block truncate text-[11px] text-text-tertiary">
          {plugin.format === "claude" ? "Claude" : "Codex"} · {totalComponents}{" "}
          component{totalComponents !== 1 ? "s" : ""}
          {plugin.manifest.version ? ` · v${plugin.manifest.version}` : ""}
        </span>
      </div>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`shrink-0 text-text-tertiary transition-transform ${isSelected ? "rotate-90" : ""}`}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ── Marketplace section with plugin cards ─────────────────────────

function MarketplaceSection({
  marketplace,
  installedNames,
  installingKeys,
  search,
  selectedKey,
  onSelect,
  onInstall,
  onRemove,
  onRefresh,
}: {
  marketplace: Marketplace;
  installedNames: Set<string>;
  installingKeys: Set<string>;
  search: string;
  selectedKey: string | null;
  onSelect: (marketplaceName: string, pluginName: string) => void;
  onInstall: (marketplaceName: string, pluginName: string) => void;
  onRemove: (name: string) => void;
  onRefresh: (name: string) => void;
}) {
  const plugins = marketplace.plugins.filter((p) => {
    if (!search) return true;
    return (
      p.name.toLowerCase().includes(search) ||
      (p.description || "").toLowerCase().includes(search)
    );
  });

  const title = marketplace.displayName || marketplace.name;

  return (
    <Section
      title={title}
      count={plugins.length}
      right={
        <div className="flex shrink-0 gap-1">
          <IconButton
            title="Refresh"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(marketplace.name);
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </IconButton>
          <IconButton
            title="Remove marketplace"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(marketplace.name);
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </div>
      }
    >
      {marketplace.error && (
        <p className="mb-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-400">
          {marketplace.error}
        </p>
      )}
      {plugins.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-text-tertiary">
          {search ? "No matching plugins." : "This marketplace is empty."}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {plugins.map((p) => {
            const key = `${marketplace.name}/${p.name}`;
            return (
              <MarketplacePluginRow
                key={key}
                plugin={p}
                selected={selectedKey === key}
                installed={installedNames.has(p.name)}
                installing={installingKeys.has(key)}
                onSelect={() => onSelect(marketplace.name, p.name)}
                onInstall={() => onInstall(marketplace.name, p.name)}
              />
            );
          })}
        </div>
      )}
    </Section>
  );
}

function MarketplacePluginRow({
  plugin,
  selected,
  installed,
  installing,
  onSelect,
  onInstall,
}: {
  plugin: MarketplacePluginEntry;
  selected: boolean;
  installed: boolean;
  installing: boolean;
  onSelect: () => void;
  onInstall: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
        selected ? "bg-accent/10 text-accent" : "text-text hover:bg-surface-hover"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          selected
            ? "bg-accent/20 text-accent"
            : "bg-surface-tertiary text-text-tertiary"
        }`}
      >
        <PluginIcon />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm">{plugin.name}</span>
        {plugin.description && (
          <span className="block truncate text-[11px] text-text-tertiary">
            {plugin.description}
          </span>
        )}
      </div>
      {installed ? (
        <span className="shrink-0 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
          Installed
        </span>
      ) : installing ? (
        <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
          Installing…
        </span>
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onInstall();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onInstall();
            }
          }}
          className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100"
        >
          Install
        </span>
      )}
    </button>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text"
    >
      {children}
    </button>
  );
}

function PluginIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// ── Right panel: detail view (installed plugin) ───────────────────

type PluginTab =
  | "skills"
  | "mcpServers"
  | "agents"
  | "commands"
  | "hooks"
  | "lsp"
  | "monitors";

const TABS: { key: PluginTab; label: string; supported: boolean }[] = [
  { key: "skills", label: "Skills", supported: true },
  { key: "mcpServers", label: "MCP", supported: true },
  { key: "agents", label: "Agents", supported: false },
  { key: "commands", label: "Commands", supported: false },
  { key: "hooks", label: "Hooks", supported: false },
  { key: "lsp", label: "LSP", supported: false },
  { key: "monitors", label: "Monitors", supported: false },
];

function sourceLabel(plugin: InstalledPlugin): string {
  const s = plugin.source;
  if (s.type === "github") {
    return `GitHub: ${s.repo}${s.ref ? `@${s.ref}` : ""}`;
  }
  if (s.type === "url") {
    return `Git: ${s.url}${s.ref ? `@${s.ref}` : ""}`;
  }
  return `Local: ${s.path}`;
}

function authorLabel(plugin: InstalledPlugin): string | null {
  const a = plugin.manifest.author;
  if (!a) return null;
  if (typeof a === "string") return a;
  return a.name || null;
}

export function PluginDetailView({
  plugin,
  onBack,
  onRemove,
}: {
  plugin: InstalledPlugin;
  onBack: () => void;
  onRemove: (name: string) => void;
}) {
  const [tab, setTab] = useState<PluginTab>("skills");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-text">
            {plugin.name}
          </h3>
          <button
            onClick={() => onRemove(plugin.name)}
            className="shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
          >
            Remove
          </button>
        </div>

        {plugin.manifest.description && (
          <p className="mb-3 text-sm text-text-secondary">
            {plugin.manifest.description}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Format</span>
            <div className="mt-0.5 text-text">
              {plugin.format === "claude" ? "Claude plugin" : "Codex plugin"}
            </div>
          </div>
          {plugin.manifest.version && (
            <div>
              <span className="text-text-tertiary">Version</span>
              <div className="mt-0.5 text-text">v{plugin.manifest.version}</div>
            </div>
          )}
          {authorLabel(plugin) && (
            <div className="min-w-0">
              <span className="text-text-tertiary">Author</span>
              <div className="mt-0.5 max-w-[240px] truncate text-text">
                {authorLabel(plugin)}
              </div>
            </div>
          )}
          {plugin.marketplaceName && (
            <div>
              <span className="text-text-tertiary">Marketplace</span>
              <div className="mt-0.5 text-text">{plugin.marketplaceName}</div>
            </div>
          )}
          <div className="min-w-0">
            <span className="text-text-tertiary">Source</span>
            <div
              className="mt-0.5 max-w-[320px] truncate font-mono text-text"
              title={sourceLabel(plugin)}
            >
              {sourceLabel(plugin)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const count = plugin.components[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "bg-accent/10 text-accent"
                    : "text-text-tertiary hover:bg-surface-hover hover:text-text"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 px-6 pt-4 pb-8">
        <TabContent plugin={plugin} tab={tab} />
      </div>
    </div>
  );
}

function TabContent({
  plugin,
  tab,
}: {
  plugin: InstalledPlugin;
  tab: PluginTab;
}) {
  const count = plugin.components[tab];
  const tabSpec = TABS.find((t) => t.key === tab)!;

  if (count === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No {tabSpec.label.toLowerCase()} in this plugin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!tabSpec.supported && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          These {tabSpec.label.toLowerCase()} are listed in the plugin but not
          yet loaded by opencowork. They will activate when the backend adds
          support.
        </div>
      )}
      <ComponentSummary plugin={plugin} tab={tab} />
    </div>
  );
}

function ComponentSummary({
  plugin,
  tab,
}: {
  plugin: InstalledPlugin;
  tab: PluginTab;
}) {
  const count = plugin.components[tab];

  if (tab === "skills") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-text-tertiary">
          {count} skill{count !== 1 ? "s" : ""} mirrored into your skills
          library. They appear under <code className="text-accent">/</code> after
          a restart.
        </p>
        <ul className="flex flex-col gap-1.5">
          {plugin.mirroredSkills.map((name) => (
            <li
              key={name}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-xs text-text"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (tab === "mcpServers") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-text-tertiary">
          {count} MCP server{count !== 1 ? "s" : ""} merged into the Connectors
          config. They appear in the Connectors tab after a restart.
        </p>
        <ul className="flex flex-col gap-1.5">
          {plugin.mergedMcpKeys.map((key) => (
            <li
              key={key}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-xs text-text"
            >
              {key}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p className="text-xs text-text-tertiary">
      {count} item{count !== 1 ? "s" : ""} declared in the plugin manifest.
    </p>
  );
}

// ── Right panel: detail view (marketplace plugin, preview) ────────

type InventoryCounts = {
  skills: number;
  mcpServers: number;
  agents: number;
  commands: number;
  hooks: number;
  lsp: number;
  monitors: number;
};

function countsFromInventory(inv?: PluginComponents): InventoryCounts {
  return {
    skills: inv?.skills.length ?? 0,
    mcpServers: inv?.mcpServers.length ?? 0,
    agents: inv?.agents.length ?? 0,
    commands: inv?.commands.length ?? 0,
    hooks: inv?.hooks.length ?? 0,
    lsp: inv?.lsp.length ?? 0,
    monitors: inv?.monitors.length ?? 0,
  };
}

function marketplaceAuthorLabel(entry: MarketplacePluginEntry): string | null {
  return entry.author || null;
}

function manifestAuthorLabel(manifest?: PluginManifest): string | null {
  if (!manifest?.author) return null;
  if (typeof manifest.author === "string") return manifest.author;
  return manifest.author.name || null;
}

export function MarketplacePluginDetailView({
  marketplaceName,
  inspection,
  loading,
  installed,
  installing,
  onBack,
  onInstall,
}: {
  marketplaceName: string;
  inspection: MarketplacePluginInspection | null;
  loading: boolean;
  installed: boolean;
  installing: boolean;
  onBack: () => void;
  onInstall: () => void;
}) {
  const [tab, setTab] = useState<PluginTab>("skills");

  if (loading || !inspection) {
    return (
      <div className="flex flex-col">
        <div className="border-b border-border px-6 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            >
              <BackArrow />
            </button>
            <p className="text-sm text-text-tertiary">Loading plugin…</p>
          </div>
        </div>
      </div>
    );
  }

  const { entry, inventory, manifest, format } = inspection;
  const counts = countsFromInventory(inventory);
  const author = manifestAuthorLabel(manifest) || marketplaceAuthorLabel(entry);
  const description = manifest?.description || entry.description;
  const version = manifest?.version || entry.version;
  const src = entry.source;

  const sourceText = (() => {
    switch (src.source) {
      case "github":
        return `GitHub: ${src.repo || "?"}${src.ref ? `@${src.ref}` : ""}`;
      case "url":
        return `Git: ${src.url || "?"}${src.ref ? `@${src.ref}` : ""}`;
      case "git-subdir":
        return `Git-subdir: ${src.url || "?"}/${src.path || ""}${src.ref ? `@${src.ref}` : ""}`;
      case "npm":
        return `npm: ${src.package || "?"}${src.version ? `@${src.version}` : ""}`;
      case "local":
        return `Local: ${src.path || "?"}`;
      default:
        return src.source;
    }
  })();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <BackArrow />
          </button>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-text">
            {entry.name}
          </h3>
          {installed ? (
            <span className="shrink-0 rounded bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
              Installed
            </span>
          ) : installing ? (
            <span className="shrink-0 rounded bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
              Installing…
            </span>
          ) : (
            <button
              onClick={onInstall}
              className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Install
            </button>
          )}
        </div>

        {description && (
          <p className="mb-3 text-sm text-text-secondary">{description}</p>
        )}

        {!inspection.inspected && inspection.error && (
          <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
            {inspection.error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Marketplace</span>
            <div className="mt-0.5 text-text">{marketplaceName}</div>
          </div>
          {format && (
            <div>
              <span className="text-text-tertiary">Format</span>
              <div className="mt-0.5 text-text">
                {format === "claude" ? "Claude plugin" : "Codex plugin"}
              </div>
            </div>
          )}
          {version && (
            <div>
              <span className="text-text-tertiary">Version</span>
              <div className="mt-0.5 text-text">v{version}</div>
            </div>
          )}
          {author && (
            <div className="min-w-0">
              <span className="text-text-tertiary">Author</span>
              <div className="mt-0.5 max-w-[240px] truncate text-text">
                {author}
              </div>
            </div>
          )}
          {entry.category && (
            <div>
              <span className="text-text-tertiary">Category</span>
              <div className="mt-0.5 text-text">{entry.category}</div>
            </div>
          )}
          <div className="min-w-0">
            <span className="text-text-tertiary">Source</span>
            <div
              className="mt-0.5 max-w-[320px] truncate font-mono text-text"
              title={sourceText}
            >
              {sourceText}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "bg-accent/10 text-accent"
                    : "text-text-tertiary hover:bg-surface-hover hover:text-text"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 px-6 pt-4 pb-8">
        <MarketplaceTabContent inspection={inspection} tab={tab} />
      </div>
    </div>
  );
}

function MarketplaceTabContent({
  inspection,
  tab,
}: {
  inspection: MarketplacePluginInspection;
  tab: PluginTab;
}) {
  const tabSpec = TABS.find((t) => t.key === tab)!;

  if (!inspection.inspected || !inspection.inventory) {
    return (
      <p className="text-sm text-text-tertiary">
        Install the plugin to inspect its {tabSpec.label.toLowerCase()}.
      </p>
    );
  }

  const items = (() => {
    const inv = inspection.inventory;
    switch (tab) {
      case "skills":
        return inv.skills.map((s) => ({
          name: s.name,
          description: s.description,
        }));
      case "mcpServers":
        return inv.mcpServers.map((m) => ({
          name: m.name,
          description: undefined as string | undefined,
        }));
      case "agents":
        return inv.agents.map((a) => ({
          name: a.name,
          description: a.description,
        }));
      case "commands":
        return inv.commands.map((c) => ({
          name: c.name,
          description: c.description,
        }));
      case "hooks":
        return inv.hooks.map((h) => ({
          name: h.name,
          description: h.description,
        }));
      case "lsp":
        return inv.lsp.map((l) => ({
          name: l.name,
          description: l.description,
        }));
      case "monitors":
        return inv.monitors.map((m) => ({
          name: m.name,
          description: m.description,
        }));
    }
  })();

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No {tabSpec.label.toLowerCase()} in this plugin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!tabSpec.supported && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          These {tabSpec.label.toLowerCase()} are listed in the plugin but not
          yet loaded by opencowork. They will activate when the backend adds
          support.
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.name}
            className="rounded-md border border-border bg-surface-secondary px-3 py-2"
          >
            <div className="font-mono text-xs text-text">{item.name}</div>
            {item.description && (
              <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                {item.description}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
