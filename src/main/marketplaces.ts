import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import log from "electron-log";
import {
  installPluginFromSource,
  readPluginManifest,
  inventoryPluginComponents,
  type PluginSource,
  type InstallResult,
  type PluginManifest,
  type PluginFormat,
  type PluginComponents,
} from "./plugins";

const execFileAsync = promisify(execFile);

// ── Paths ────────────────────────────────────────────────────────

const MARKETPLACES_DIR = join(homedir(), ".claude", "marketplaces");
const REGISTRY_PATH = join(MARKETPLACES_DIR, "registry.json");

// ── Types ────────────────────────────────────────────────────────

export type MarketplaceSource =
  | { type: "github"; repo: string; ref?: string }
  | { type: "url"; url: string; ref?: string }
  | { type: "local"; path: string };

/** Shape of plugin.source inside marketplace.json */
export interface MarketplacePluginSource {
  source: "github" | "url" | "git-subdir" | "npm" | "local";
  repo?: string;
  url?: string;
  path?: string;
  ref?: string;
  sha?: string;
  package?: string;
  version?: string;
}

export interface MarketplacePluginEntry {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  source: MarketplacePluginSource;
}

export interface Marketplace {
  /** Name from marketplace.json */
  name: string;
  displayName?: string;
  addedAt: number;
  /** How the user added this marketplace */
  source: MarketplaceSource;
  /** Absolute path where the marketplace lives on disk */
  marketplaceDir: string;
  plugins: MarketplacePluginEntry[];
  /** Last refresh error, if any */
  error?: string;
}

interface MarketplaceRegistry {
  version: 1;
  marketplaces: Record<string, Marketplace>;
}

// ── Registry I/O ─────────────────────────────────────────────────

function readRegistry(): MarketplaceRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, marketplaces: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
    if (parsed && typeof parsed === "object" && parsed.marketplaces) {
      return parsed as MarketplaceRegistry;
    }
    return { version: 1, marketplaces: {} };
  } catch (err) {
    log.warn("Corrupt marketplaces registry, resetting:", err);
    return { version: 1, marketplaces: {} };
  }
}

function writeRegistry(reg: MarketplaceRegistry): void {
  if (!existsSync(MARKETPLACES_DIR))
    mkdirSync(MARKETPLACES_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + "\n", "utf-8");
}

export function listMarketplaces(): Marketplace[] {
  return Object.values(readRegistry().marketplaces).sort(
    (a, b) => a.addedAt - b.addedAt,
  );
}

// ── Git operations ───────────────────────────────────────────────

function normalizeRepo(input: string): string {
  const trimmed = input.trim();
  if (/^(https?:\/\/|git@|ssh:\/\/)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    return `https://github.com/${trimmed}.git`;
  }
  return trimmed;
}

async function gitClone(
  url: string,
  dest: string,
  ref?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const args = ["clone", "--depth", "1"];
  if (ref && ref.trim()) args.push("--branch", ref.trim());
  args.push(url, dest);
  try {
    await execFileAsync("git", args, {
      timeout: 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true };
  } catch (err: unknown) {
    const stderr =
      (err as { stderr?: string }).stderr ||
      (err instanceof Error ? err.message : "Unknown git error");
    return { ok: false, error: String(stderr).trim() };
  }
}

// ── Marketplace manifest parsing ────────────────────────────────

interface ParsedMarketplace {
  name: string;
  displayName?: string;
  plugins: MarketplacePluginEntry[];
}

/** Normalize plugin.source, which can be a shorthand string or a full object. */
function parsePluginSource(raw: unknown): MarketplacePluginSource | null {
  // Shorthand string form: resolve to github/url/local based on content
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    if (/^(https?:\/\/|git@|ssh:\/\/)/i.test(s)) {
      return { source: "url", url: s };
    }
    // "owner/repo" shorthand
    if (/^[\w.-]+\/[\w.-]+$/.test(s) && !s.startsWith(".")) {
      return { source: "github", repo: s };
    }
    // Treat everything else (./foo, foo/bar/baz, absolute paths) as a local path
    return { source: "local", path: s };
  }
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.source !== "string") return null;
  return {
    source: src.source as MarketplacePluginSource["source"],
    repo: typeof src.repo === "string" ? src.repo : undefined,
    url: typeof src.url === "string" ? src.url : undefined,
    path: typeof src.path === "string" ? src.path : undefined,
    ref: typeof src.ref === "string" ? src.ref : undefined,
    sha: typeof src.sha === "string" ? src.sha : undefined,
    package: typeof src.package === "string" ? src.package : undefined,
    version: typeof src.version === "string" ? src.version : undefined,
  };
}

function parsePluginEntry(raw: unknown): MarketplacePluginEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name) return null;
  const source = parsePluginSource(r.source);
  if (!source) return null;

  const authorRaw = r.author;
  const author =
    typeof authorRaw === "string"
      ? authorRaw
      : authorRaw && typeof authorRaw === "object"
        ? ((authorRaw as Record<string, unknown>).name as string) || undefined
        : undefined;

  return {
    name: r.name,
    description: typeof r.description === "string" ? r.description : undefined,
    version: typeof r.version === "string" ? r.version : undefined,
    author,
    category: typeof r.category === "string" ? r.category : undefined,
    source,
  };
}

function readMarketplaceManifest(rootDir: string): ParsedMarketplace | null {
  const candidates = [
    join(rootDir, ".claude-plugin", "marketplace.json"),
    join(rootDir, ".agents", "plugins", "marketplace.json"),
    join(rootDir, ".codex-plugin", "marketplace.json"),
    join(rootDir, "marketplace.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<
        string,
        unknown
      >;
      const name = typeof raw.name === "string" ? raw.name : undefined;
      if (!name) continue;
      const interfaceObj = raw.interface as Record<string, unknown> | undefined;
      const displayName =
        interfaceObj && typeof interfaceObj.displayName === "string"
          ? interfaceObj.displayName
          : undefined;
      const rawPlugins = Array.isArray(raw.plugins) ? raw.plugins : [];
      const plugins: MarketplacePluginEntry[] = [];
      for (const entry of rawPlugins) {
        const p = parsePluginEntry(entry);
        if (p) plugins.push(p);
      }
      return { name, displayName, plugins };
    } catch (err) {
      log.warn(`Failed to parse marketplace manifest at ${path}:`, err);
    }
  }
  return null;
}

// ── Add / remove / refresh ──────────────────────────────────────

export interface AddMarketplaceResult {
  ok: true;
  marketplace: Marketplace;
}

export interface AddMarketplaceError {
  ok: false;
  error: string;
}

export async function addMarketplace(
  source: MarketplaceSource,
): Promise<AddMarketplaceResult | AddMarketplaceError> {
  if (!existsSync(MARKETPLACES_DIR))
    mkdirSync(MARKETPLACES_DIR, { recursive: true });

  // Step 1: resolve source to marketplaceDir
  let marketplaceDir: string;
  let tmpClone: string | null = null;

  if (source.type === "local") {
    if (!existsSync(source.path) || !statSync(source.path).isDirectory()) {
      return { ok: false, error: `Folder does not exist: ${source.path}` };
    }
    marketplaceDir = source.path;
  } else {
    const url =
      source.type === "github" ? normalizeRepo(source.repo) : source.url;
    const tmpDest = join(MARKETPLACES_DIR, `.tmp-${Date.now()}`);
    const cloneResult = await gitClone(url, tmpDest, source.ref);
    if (!cloneResult.ok) {
      return { ok: false, error: `git clone failed: ${cloneResult.error}` };
    }
    marketplaceDir = tmpDest;
    tmpClone = tmpDest;
  }

  // Step 2: parse marketplace manifest
  const parsed = readMarketplaceManifest(marketplaceDir);
  if (!parsed) {
    if (tmpClone) rmSync(tmpClone, { recursive: true, force: true });
    return {
      ok: false,
      error:
        "No marketplace manifest found. Expected .claude-plugin/marketplace.json, .agents/plugins/marketplace.json, or .codex-plugin/marketplace.json.",
    };
  }

  const marketplaceName = parsed.name.replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!marketplaceName) {
    if (tmpClone) rmSync(tmpClone, { recursive: true, force: true });
    return { ok: false, error: "Marketplace manifest has an invalid name." };
  }

  // Step 3: check for duplicate
  const reg = readRegistry();
  if (reg.marketplaces[marketplaceName]) {
    if (tmpClone) rmSync(tmpClone, { recursive: true, force: true });
    return {
      ok: false,
      error: `Marketplace "${marketplaceName}" is already added. Remove it first to re-add.`,
    };
  }

  // Step 4: move clone into final location (skip for local)
  let finalDir: string;
  if (source.type === "local") {
    finalDir = marketplaceDir;
  } else {
    finalDir = join(MARKETPLACES_DIR, marketplaceName);
    if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true });
    cpSync(marketplaceDir, finalDir, { recursive: true });
    rmSync(marketplaceDir, { recursive: true, force: true });
  }

  const entry: Marketplace = {
    name: marketplaceName,
    displayName: parsed.displayName,
    addedAt: Date.now(),
    source,
    marketplaceDir: finalDir,
    plugins: parsed.plugins,
  };
  reg.marketplaces[marketplaceName] = entry;
  writeRegistry(reg);

  log.info(
    `Added marketplace "${marketplaceName}" with ${parsed.plugins.length} plugins`,
  );
  return { ok: true, marketplace: entry };
}

export interface RemoveResult {
  ok: boolean;
  error?: string;
}

export function removeMarketplace(name: string): RemoveResult {
  const reg = readRegistry();
  const entry = reg.marketplaces[name];
  if (!entry) return { ok: false, error: `Marketplace "${name}" not found.` };

  if (entry.source.type !== "local" && existsSync(entry.marketplaceDir)) {
    try {
      rmSync(entry.marketplaceDir, { recursive: true, force: true });
    } catch (err) {
      log.warn(
        `Failed to remove marketplace dir ${entry.marketplaceDir}:`,
        err,
      );
    }
  }

  delete reg.marketplaces[name];
  writeRegistry(reg);
  log.info(`Removed marketplace "${name}"`);
  return { ok: true };
}

export async function refreshMarketplace(
  name: string,
): Promise<AddMarketplaceResult | AddMarketplaceError> {
  const reg = readRegistry();
  const entry = reg.marketplaces[name];
  if (!entry) return { ok: false, error: `Marketplace "${name}" not found.` };

  // For local sources, just re-parse
  if (entry.source.type === "local") {
    const parsed = readMarketplaceManifest(entry.marketplaceDir);
    if (!parsed) {
      entry.error = "Marketplace manifest no longer readable.";
      writeRegistry(reg);
      return { ok: false, error: entry.error };
    }
    entry.displayName = parsed.displayName;
    entry.plugins = parsed.plugins;
    entry.error = undefined;
    writeRegistry(reg);
    return { ok: true, marketplace: entry };
  }

  // For git sources, re-clone into a tmp and swap
  const url =
    entry.source.type === "github"
      ? normalizeRepo(entry.source.repo)
      : entry.source.url;
  const tmpDest = join(MARKETPLACES_DIR, `.refresh-${Date.now()}`);
  const cloneResult = await gitClone(url, tmpDest, entry.source.ref);
  if (!cloneResult.ok) {
    entry.error = `git clone failed: ${cloneResult.error}`;
    writeRegistry(reg);
    return { ok: false, error: entry.error };
  }
  const parsed = readMarketplaceManifest(tmpDest);
  if (!parsed) {
    rmSync(tmpDest, { recursive: true, force: true });
    entry.error = "No marketplace manifest in refreshed clone.";
    writeRegistry(reg);
    return { ok: false, error: entry.error };
  }
  // Swap
  if (existsSync(entry.marketplaceDir)) {
    rmSync(entry.marketplaceDir, { recursive: true, force: true });
  }
  cpSync(tmpDest, entry.marketplaceDir, { recursive: true });
  rmSync(tmpDest, { recursive: true, force: true });

  entry.displayName = parsed.displayName;
  entry.plugins = parsed.plugins;
  entry.error = undefined;
  writeRegistry(reg);
  return { ok: true, marketplace: entry };
}

// ── Install a plugin from a marketplace ────────────────────────

export async function installMarketplacePlugin(
  marketplaceName: string,
  pluginName: string,
): Promise<InstallResult> {
  const reg = readRegistry();
  const marketplace = reg.marketplaces[marketplaceName];
  if (!marketplace) {
    return { ok: false, error: `Marketplace "${marketplaceName}" not found.` };
  }
  const pluginEntry = marketplace.plugins.find((p) => p.name === pluginName);
  if (!pluginEntry) {
    return {
      ok: false,
      error: `Plugin "${pluginName}" not found in marketplace "${marketplaceName}".`,
    };
  }

  const src = pluginEntry.source;
  let pluginSource: PluginSource;
  let subdir: string | undefined;

  switch (src.source) {
    case "github": {
      if (!src.repo)
        return { ok: false, error: `Plugin "${pluginName}" is missing repo.` };
      pluginSource = { type: "github", repo: src.repo, ref: src.ref };
      break;
    }
    case "url": {
      if (!src.url)
        return { ok: false, error: `Plugin "${pluginName}" is missing url.` };
      pluginSource = { type: "url", url: src.url, ref: src.ref };
      break;
    }
    case "git-subdir": {
      if (!src.url || !src.path) {
        return {
          ok: false,
          error: `Plugin "${pluginName}" git-subdir source is missing url or path.`,
        };
      }
      pluginSource = { type: "url", url: src.url, ref: src.ref };
      subdir = src.path;
      break;
    }
    case "local": {
      if (!src.path) {
        return {
          ok: false,
          error: `Plugin "${pluginName}" local source is missing path.`,
        };
      }
      // Resolve relative to marketplace root
      const abs = join(marketplace.marketplaceDir, src.path);
      pluginSource = { type: "local", path: abs };
      break;
    }
    case "npm": {
      return {
        ok: false,
        error:
          "npm plugin sources are not supported yet. Please install this plugin manually.",
      };
    }
    default:
      return {
        ok: false,
        error: `Unknown plugin source type: ${src.source}`,
      };
  }

  return installPluginFromSource(pluginSource, {
    subdir,
    marketplaceName,
  });
}

// ── Inspect a marketplace plugin (preview before install) ──────

export interface MarketplacePluginInspection {
  /** Marketplace entry metadata (always present) */
  entry: MarketplacePluginEntry;
  /** True when the plugin files were reachable without cloning (local sources) */
  inspected: boolean;
  /** Plugin manifest from plugin.json, if we could read it */
  manifest?: PluginManifest;
  format?: PluginFormat;
  /** Full component inventory, if we could read it */
  inventory?: PluginComponents;
  /** Reason we couldn't inspect (remote source, missing manifest, etc.) */
  error?: string;
}

export function inspectMarketplacePlugin(
  marketplaceName: string,
  pluginName: string,
): MarketplacePluginInspection | { error: string } {
  const reg = readRegistry();
  const marketplace = reg.marketplaces[marketplaceName];
  if (!marketplace) {
    return { error: `Marketplace "${marketplaceName}" not found.` };
  }
  const entry = marketplace.plugins.find((p) => p.name === pluginName);
  if (!entry) {
    return {
      error: `Plugin "${pluginName}" not found in marketplace "${marketplaceName}".`,
    };
  }

  const result: MarketplacePluginInspection = { entry, inspected: false };

  // Resolve local path if possible
  let pluginDir: string | null = null;
  const src = entry.source;
  if (src.source === "local" && src.path) {
    pluginDir = join(marketplace.marketplaceDir, src.path);
  }
  // git-subdir pointing at an already-present marketplace dir is also local-ish,
  // but it requires cloning the *plugin's* repo — skip for inspection.

  if (!pluginDir) {
    result.error =
      "Remote plugin — install to see the full component inventory.";
    return result;
  }

  if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
    result.error = `Plugin folder missing on disk: ${pluginDir}`;
    return result;
  }

  const parsed = readPluginManifest(pluginDir);
  if (parsed) {
    result.manifest = parsed.manifest;
    result.format = parsed.format;
  }
  result.inventory = inventoryPluginComponents(pluginDir);
  result.inspected = true;
  return result;
}

