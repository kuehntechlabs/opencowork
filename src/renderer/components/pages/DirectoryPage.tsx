import { useState, useMemo, useCallback } from "react";
import {
  type CatalogCategory,
  type CatalogTab,
  type CatalogItem,
  getCatalogItems,
  formatDownloads,
} from "../../data/marketplace-catalog";

type SortOption = "popular" | "name" | "recent";
type FilterTag = string | null;

interface Props {
  onClose: () => void;
  onInstall: (item: CatalogItem) => void;
  installedNames: Set<string>;
}

const CATEGORIES: { key: CatalogCategory; label: string; icon: JSX.Element }[] =
  [
    {
      key: "skills",
      label: "Skills",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      key: "connectors",
      label: "Connectors",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
    {
      key: "plugins",
      label: "Plugins",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
  ];

const TABS: { key: CatalogTab; label: string }[] = [
  { key: "yours", label: "Your organization" },
  { key: "shared", label: "Shared" },
  { key: "community", label: "Community" },
];

export function DirectoryPage({ onClose, onInstall, installedNames }: Props) {
  const [category, setCategory] = useState<CatalogCategory>("skills");
  const [tab, setTab] = useState<CatalogTab>("community");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");
  const [filterTag, setFilterTag] = useState<FilterTag>(null);

  const items = useMemo(() => {
    let list = getCatalogItems(category, tab);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q),
      );
    }

    if (filterTag) {
      list = list.filter((item) => item.tags?.includes(filterTag));
    }

    if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    // "popular" is default sort from getCatalogItems, "recent" kept same for now

    return list;
  }, [category, tab, search, sort, filterTag]);

  // Collect all unique tags for current category+tab
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    getCatalogItems(category, tab).forEach((item) =>
      item.tags?.forEach((t) => tags.add(t)),
    );
    return Array.from(tags).sort();
  }, [category, tab]);

  const handleInstall = useCallback(
    (item: CatalogItem) => {
      onInstall(item);
    },
    [onInstall],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Left sidebar */}
      <div className="flex w-48 shrink-0 flex-col border-r border-border bg-surface">
        <div className="drag-region flex h-12 shrink-0 items-center" />
        <div className="px-4 pb-6">
          <h2 className="mb-5 text-lg font-semibold text-text">Directory</h2>
          <div className="flex flex-col gap-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  setCategory(cat.key);
                  setSearch("");
                  setFilterTag(null);
                }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  category === cat.key
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-text hover:bg-surface-hover"
                }`}
              >
                <span className="shrink-0">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar with drag region, search, close */}
        <div className="drag-region flex h-12 shrink-0 items-center gap-3 px-6">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="no-drag rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            title="Close"
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

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Search bar */}
          <div className="relative mb-4">
            <svg
              width="15"
              height="15"
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${CATEGORIES.find((c) => c.key === category)?.label.toLowerCase()}...`}
              className="w-full rounded-lg border border-border bg-surface-secondary py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>

          {/* Tabs + Filter/Sort row */}
          <div className="mb-5 flex items-center gap-4">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setFilterTag(null);
                  }}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.key
                      ? "border border-accent bg-accent/10 text-accent"
                      : "border border-transparent text-text-tertiary hover:bg-surface-hover hover:text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Tag filter */}
              {allTags.length > 0 && (
                <select
                  value={filterTag || ""}
                  onChange={(e) => setFilterTag(e.target.value || null)}
                  className="rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                >
                  <option value="">Filter by</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
              >
                <option value="popular">Sort by</option>
                <option value="popular">Most popular</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>

          {/* Card grid */}
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-tertiary">
                {tab === "community"
                  ? search
                    ? "No matching items found."
                    : "No items in this category yet."
                  : `No ${tab === "yours" ? "organization" : "shared"} items yet.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <CatalogCard
                  key={item.name}
                  item={item}
                  installed={installedNames.has(item.name)}
                  onInstall={handleInstall}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Catalog Card ─────────────────────────────────────────────── */

function CatalogCard({
  item,
  installed,
  onInstall,
}: {
  item: CatalogItem;
  installed: boolean;
  onInstall: (item: CatalogItem) => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-surface-secondary p-4 transition-colors hover:border-border/80 hover:bg-surface-hover/50">
      {/* Install / Installed button */}
      <button
        onClick={() => !installed && onInstall(item)}
        disabled={installed}
        className={`absolute right-3 top-3 rounded-md p-1 transition-colors ${
          installed
            ? "text-green-400"
            : "text-text-tertiary opacity-0 hover:bg-surface-hover hover:text-text group-hover:opacity-100"
        }`}
        title={installed ? "Installed" : "Install"}
      >
        {installed ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>

      {/* Name */}
      <h3 className="mb-1 pr-6 text-sm font-medium text-text">{item.name}</h3>

      {/* Author + downloads */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <span>{item.author}</span>
        <span className="text-text-tertiary/50">&bull;</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{formatDownloads(item.downloads)}</span>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
        {item.description}
      </p>
    </div>
  );
}
