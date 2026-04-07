import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  type CatalogCategory,
  type CatalogItem,
  CONNECTORS,
  formatDownloads,
} from "../../data/marketplace-catalog";
import {
  fetchAllPlugins,
  fetchDefaultSkills,
  searchSkills,
} from "../../data/marketplace-fetch";

type SortOption = "popular" | "name";

interface Props {
  onClose: () => void;
  onInstall: (item: CatalogItem) => void;
  installedNames: Set<string>;
  initialCategory?: CatalogCategory;
}

const CATEGORIES: {
  key: CatalogCategory;
  label: string;
  icon: JSX.Element;
}[] = [
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
];

export function DirectoryPage({
  onClose,
  onInstall,
  installedNames,
  initialCategory,
}: Props) {
  const [category, setCategory] = useState<CatalogCategory>(
    initialCategory ?? "skills",
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("popular");
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);

  // Live data
  const [skills, setSkills] = useState<CatalogItem[]>([]);
  const [plugins, setPlugins] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Search
  const [searchResults, setSearchResults] = useState<CatalogItem[] | null>(
    null,
  );
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const fetchId = useRef(0);

  // Sync category from prop
  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  // Load data on mount / category change
  useEffect(() => {
    if (category === "connectors") return;
    if (category === "plugins" && plugins.length > 0) return;
    if (category === "skills" && skills.length > 0) return;

    setLoading(true);
    setPage(1);
    const id = ++fetchId.current;

    if (category === "plugins") {
      fetchAllPlugins((partial) => {
        if (fetchId.current !== id) return;
        setPlugins(partial);
      }).finally(() => {
        if (fetchId.current === id) setLoading(false);
      });
    } else {
      fetchDefaultSkills()
        .then((items) => {
          if (fetchId.current !== id) return;
          setSkills(items);
        })
        .finally(() => {
          if (fetchId.current === id) setLoading(false);
        });
    }
  }, [category]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      clearTimeout(searchTimeout.current);

      if (!value.trim()) {
        setSearchResults(null);
        return;
      }

      if (category === "skills") {
        searchTimeout.current = setTimeout(() => {
          searchSkills(value).then(setSearchResults);
        }, 400);
      } else {
        setSearchResults(null);
      }
    },
    [category],
  );

  // Build display items (all, before pagination)
  const allItems = useMemo(() => {
    let list: CatalogItem[];

    if (category === "connectors") {
      list = CONNECTORS;
    } else if (category === "skills" && searchResults) {
      list = searchResults;
    } else if (category === "skills") {
      list = skills;
    } else {
      list = plugins;
    }

    // Client-side search for plugins/connectors
    if (search.trim() && !searchResults) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q),
      );
    }

    if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort((a, b) => b.downloads - a.downloads);
    }

    return list;
  }, [category, search, sort, skills, plugins, searchResults]);

  // Paginate
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const items = useMemo(
    () => allItems.slice(0, page * PAGE_SIZE),
    [allItems, page],
  );
  const hasMore = page * PAGE_SIZE < totalItems;

  const handleInstall = useCallback(
    (item: CatalogItem) => onInstall(item),
    [onInstall],
  );

  const isLoading = loading && category !== "connectors";

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
                  setSearchResults(null);
                  setPage(1);
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
        {/* Top bar */}
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
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={`Search ${CATEGORIES.find((c) => c.key === category)?.label.toLowerCase()}...`}
              className="w-full rounded-lg border border-border bg-surface-secondary py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>

          {/* Sort + count row */}
          <div className="mb-5 flex items-center justify-between">
            <div className="text-xs text-text-tertiary">
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  {totalItems.toLocaleString()}{" "}
                  {category === "plugins"
                    ? "plugins"
                    : category === "connectors"
                      ? "connectors"
                      : "skills"}
                  {hasMore && ` (showing ${items.length.toLocaleString()})`}
                </span>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
            >
              <option value="popular">Most popular</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          {/* Card grid */}
          {isLoading && items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-sm text-text-tertiary">
                Loading from skills.sh...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-tertiary">
                {search ? "No matching items found." : "No items yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {items.map((item, idx) => (
                  <CatalogCard
                    key={`${item.installRef}-${idx}`}
                    item={item}
                    installed={installedNames.has(item.name)}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-border px-6 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    Load more ({(totalItems - items.length).toLocaleString()}{" "}
                    remaining)
                  </button>
                </div>
              )}
            </>
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

      {/* Name with icon */}
      <div className="mb-1 flex items-center gap-2 pr-6">
        {item.iconUrl && (
          <img
            src={item.iconUrl}
            alt=""
            width={18}
            height={18}
            className="shrink-0 rounded-sm"
            loading="lazy"
          />
        )}
        <h3 className="truncate text-sm font-medium text-text">{item.name}</h3>
      </div>

      {/* Author + downloads/skill count */}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <span>{item.author}</span>
        {(item.downloads > 0 || item.skillCount) && (
          <>
            <span className="text-text-tertiary/50">&bull;</span>
            {item.skillCount ? (
              <span>{item.skillCount} skills</span>
            ) : (
              <>
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
              </>
            )}
          </>
        )}
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
        {item.description}
      </p>
    </div>
  );
}
