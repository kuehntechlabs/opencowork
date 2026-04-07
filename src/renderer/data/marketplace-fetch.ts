import type { CatalogItem } from "./marketplace-catalog";

const BASE = "https://skills.sh";

const api = (
  window as unknown as { api: import("../../preload/index").ElectronAPI }
).api;

/** Fetch a URL via main process to bypass CORS */
async function proxyFetch(url: string): Promise<string> {
  const res = await api.fetchUrl(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.body;
}

// ── Types ───────────────────────────────────────────────────────

export interface Company {
  slug: string;
  name: string;
  iconUrl: string;
}

export interface PluginCollection {
  company: Company;
  slug: string;
  name: string;
  skillCount: number;
  description: string;
  installRef: string;
}

// ── Caches ──────────────────────────────────────────────────────

let companiesCache: Company[] | null = null;
let companiesPromise: Promise<Company[]> | null = null;

const pluginsCache = new Map<string, PluginCollection[]>();

// Full results cache (survives across directory open/close)
let allPluginsCache: CatalogItem[] | null = null;
let defaultSkillsCache: CatalogItem[] | null = null;

// ── HTML helpers ────────────────────────────────────────────────

function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

// ── Level 1: /official → Companies ──────────────────────────────

async function _fetchCompanies(): Promise<Company[]> {
  let html: string;
  try {
    html = await proxyFetch(`${BASE}/official`);
  } catch {
    return [];
  }
  const doc = parseHTML(html);

  const companies: Company[] = [];
  const seen = new Set<string>();
  const skip = new Set([
    "official",
    "leaderboard",
    "api",
    "login",
    "signup",
    "docs",
    "about",
    "pricing",
  ]);

  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const match = href.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (!match) return;
    const slug = match[1];
    if (seen.has(slug) || skip.has(slug)) return;

    const hasImg = a.querySelector("img") !== null;
    const text = (a.textContent || "").trim();
    if (!hasImg && text.length < 2) return;

    seen.add(slug);
    companies.push({
      slug,
      name: slug,
      iconUrl: `https://github.com/${slug}.png`,
    });
  });

  return companies;
}

export function fetchCompanies(): Promise<Company[]> {
  if (companiesCache) return Promise.resolve(companiesCache);
  if (!companiesPromise) {
    companiesPromise = _fetchCompanies().then((c) => {
      companiesCache = c;
      return c;
    });
  }
  return companiesPromise;
}

// ── Level 2: /{company} → Plugin collections ────────────────────

async function _fetchPlugins(company: Company): Promise<PluginCollection[]> {
  let html: string;
  try {
    html = await proxyFetch(`${BASE}/${company.slug}`);
  } catch {
    return [];
  }
  const doc = parseHTML(html);

  const plugins: PluginCollection[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const match = href.match(new RegExp(`^/${company.slug}/([a-zA-Z0-9_-]+)$`));
    if (!match) return;
    const collSlug = match[1];
    if (seen.has(collSlug)) return;
    seen.add(collSlug);

    const text = a.textContent || "";
    const countMatch = text.match(/(\d+)\s*(?:skills?|items?)/i);
    const skillCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    const descText = text.replace(/\s+/g, " ").trim();

    plugins.push({
      company,
      slug: collSlug,
      name: collSlug,
      skillCount,
      description: descText.slice(0, 120) || `${collSlug} plugin collection`,
      installRef: `npx skills add ${company.slug}/${collSlug}`,
    });
  });

  return plugins;
}

export async function fetchPlugins(
  company: Company,
): Promise<PluginCollection[]> {
  const key = company.slug;
  if (pluginsCache.has(key)) return pluginsCache.get(key)!;
  const plugins = await _fetchPlugins(company);
  pluginsCache.set(key, plugins);
  return plugins;
}

// ── Skills ───────────────────────────────────────────────────────

interface LeaderboardSkill {
  source: string;
  skillId: string;
  name: string;
  installs: number;
}

interface SkillsShSearchItem {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

interface SkillsShSearchResponse {
  skills: SkillsShSearchItem[];
  count: number;
}

function skillToCatalog(
  name: string,
  source: string,
  installs: number,
): CatalogItem {
  const org = source.split("/")[0];
  return {
    name,
    author: org,
    description: `From ${source}`,
    downloads: installs,
    category: "skills",
    installRef: `${source}/${name}`,
    tags: [],
    iconUrl: `https://github.com/${org}.png`,
  };
}

/** Parse the embedded leaderboard JSON from the skills.sh homepage (single fetch) */
async function _fetchLeaderboard(): Promise<CatalogItem[]> {
  const html = await proxyFetch(BASE);

  // Extract skill objects from Next.js RSC payload
  // Quotes are backslash-escaped in the stream: \"source\":\"...\"
  const regex =
    /\\?"source\\?":\\?"([^"\\]+)\\?",\\?"skillId\\?":\\?"([^"\\]+)\\?",\\?"name\\?":\\?"([^"\\]+)\\?",\\?"installs\\?":(\d+)/g;
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  let m;

  while ((m = regex.exec(html)) !== null) {
    const [, source, , name, installs] = m;
    const key = `${source}/${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(skillToCatalog(name, source, parseInt(installs, 10)));
  }

  items.sort((a, b) => b.downloads - a.downloads);
  return items;
}

/** Search skills via the API */
export async function searchSkills(query: string): Promise<CatalogItem[]> {
  if (!query.trim()) return [];
  try {
    const body = await proxyFetch(
      `${BASE}/api/search?q=${encodeURIComponent(query)}`,
    );
    const data: SkillsShSearchResponse = JSON.parse(body);
    return data.skills.map((s) => skillToCatalog(s.name, s.source, s.installs));
  } catch {
    return [];
  }
}

let defaultSkillsPromise: Promise<CatalogItem[]> | null = null;

/** Default skills = leaderboard from homepage. Single fetch, ~500 skills, cached. */
export function fetchDefaultSkills(): Promise<CatalogItem[]> {
  if (defaultSkillsCache) return Promise.resolve(defaultSkillsCache);
  if (defaultSkillsPromise) return defaultSkillsPromise;

  defaultSkillsPromise = _fetchLeaderboard()
    .then((items) => {
      defaultSkillsCache = items;
      return items;
    })
    .catch(() => []);

  return defaultSkillsPromise;
}

// Preload on import — single fetch starts at app launch
fetchDefaultSkills();

// ── Plugins batch loader (with cache) ───────────────────────────

export async function fetchAllPlugins(
  onProgress?: (plugins: CatalogItem[]) => void,
): Promise<CatalogItem[]> {
  if (allPluginsCache) return allPluginsCache;

  const companies = await fetchCompanies();
  const allPlugins: CatalogItem[] = [];
  const batchSize = 10;

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((c) => fetchPlugins(c)));

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status !== "fulfilled") continue;
      const company = batch[j];
      for (const p of r.value) {
        allPlugins.push({
          name: p.name,
          author: company.slug,
          description: p.description,
          downloads: 0,
          category: "plugins",
          installRef: p.installRef,
          tags: [],
          iconUrl: company.iconUrl,
          skillCount: p.skillCount,
        });
      }
    }

    onProgress?.(allPlugins.slice());
  }

  allPluginsCache = allPlugins;
  return allPlugins;
}
