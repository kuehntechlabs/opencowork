import type { CatalogItem } from "./marketplace-catalog";

const REGISTRY_BASE = "https://registry.modelcontextprotocol.io";
const PAGE_LIMIT = 100;

const api = (
  window as unknown as { api: import("../../preload/index").ElectronAPI }
).api;

/** Fetch a URL via main process to bypass CORS */
async function proxyFetch(url: string): Promise<string> {
  const res = await api.fetchUrl(url);
  if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
  return res.body;
}

// ── Types from MCP Registry API ─────────────────────────────────

interface RegistryEnvVar {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

interface RegistryHeader {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

interface RegistryPackage {
  registryType: string; // "npm" | "pypi" | "oci"
  identifier: string;
  version?: string;
  transport?: { type: string };
  environmentVariables?: RegistryEnvVar[];
  args?: string[];
}

interface RegistryRemote {
  type: string; // "streamable-http" | "sse"
  url: string;
  headers?: RegistryHeader[];
}

interface RegistryServer {
  name: string;
  description?: string;
  title?: string;
  version?: string;
  websiteUrl?: string;
  icons?: { src: string; mimeType?: string; sizes?: string[] }[];
  repository?: { url?: string; source?: string };
  packages?: RegistryPackage[];
  remotes?: RegistryRemote[];
}

interface RegistryEntry {
  server: RegistryServer;
  _meta?: {
    "io.modelcontextprotocol.registry/official"?: {
      status?: string;
      isLatest?: boolean;
      publishedAt?: string;
      updatedAt?: string;
    };
  };
}

interface RegistryResponse {
  servers: RegistryEntry[];
  metadata: {
    nextCursor?: string;
    count: number;
  };
}

// ── Cache ────────────────────────────────────────────────────────

let registryCache: CatalogItem[] | null = null;
let registryPromise: Promise<CatalogItem[]> | null = null;

// ── Helpers ──────────────────────────────────────────────────────

function extractAuthor(name: string): string {
  // name format: "io.github.username/server-name" or "com.example/server"
  const parts = name.split("/");
  if (parts.length >= 2) {
    // Return the namespace, e.g. "io.github.username"
    const ns = parts[0]!;
    // Try to extract a readable name from reverse-DNS
    const segments = ns.split(".");
    // e.g. "io.github.username" → "username", "com.anthropic" → "anthropic"
    return segments[segments.length - 1] || ns;
  }
  return name;
}

function extractDisplayName(server: RegistryServer): string {
  if (server.title) return server.title;
  // "io.github.username/my-server" → "my-server"
  const parts = server.name.split("/");
  return parts[parts.length - 1] || server.name;
}

function extractIconUrl(server: RegistryServer): string | undefined {
  if (server.icons?.[0]?.src) return server.icons[0].src;
  // Try GitHub avatar from repository
  if (server.repository?.url) {
    const match = server.repository.url.match(/github\.com\/([^/]+)/);
    if (match) return `https://github.com/${match[1]}.png`;
  }
  return undefined;
}

function serverToCatalogItem(entry: RegistryEntry): CatalogItem {
  const server = entry.server;
  const displayName = extractDisplayName(server);
  const author = extractAuthor(server.name);

  const item: CatalogItem = {
    name: displayName,
    author,
    description: server.description || "",
    downloads: 0,
    category: "connectors",
    installRef: server.name,
    tags: [],
    iconUrl: extractIconUrl(server),
  };

  // Determine install method: prefer npm packages (stdio), then remote URL
  const npmPkg = server.packages?.find((p) => p.registryType === "npm");

  if (npmPkg) {
    // Local stdio via npx
    const cmd = ["npx", "-y", npmPkg.identifier];
    if (npmPkg.args) cmd.push(...npmPkg.args);
    item.mcpCommand = cmd;

    // Extract env vars
    if (npmPkg.environmentVariables?.length) {
      const env: Record<string, string> = {};
      for (const v of npmPkg.environmentVariables) {
        env[v.name] = v.description || v.name;
      }
      item.mcpEnv = env;
    }
  } else if (server.remotes?.length) {
    // Remote server — pick streamable-http over sse
    const remote =
      server.remotes.find((r) => r.type === "streamable-http") ||
      server.remotes[0]!;
    item.mcpUrl = remote.url;
    item.mcpTransport = remote.type;

    // Extract required headers as env-like prompts
    if (remote.headers?.length) {
      const headers: Record<string, string> = {};
      for (const h of remote.headers) {
        if (h.isRequired) {
          headers[h.name] = h.description || h.name;
        }
      }
      if (Object.keys(headers).length > 0) {
        item.mcpHeaders = headers;
      }
    }
  }

  // Store website URL and version for display
  if (server.websiteUrl) item.websiteUrl = server.websiteUrl;
  if (server.version) item.version = server.version;

  return item;
}

// ── Fetching ─────────────────────────────────────────────────────

async function _fetchAllServers(): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  // Paginate through all servers
  for (let i = 0; i < 50; i++) {
    // safety limit: 50 pages × 100 = 5000 servers max
    let url = `${REGISTRY_BASE}/v0.1/servers?limit=${PAGE_LIMIT}`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    let data: RegistryResponse;
    try {
      const body = await proxyFetch(url);
      data = JSON.parse(body);
    } catch (err) {
      console.error("MCP Registry fetch error:", err);
      break;
    }

    for (const entry of data.servers) {
      const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];

      // Only include latest versions of active servers
      if (!meta?.isLatest) continue;
      if (meta.status === "deleted" || meta.status === "deprecated") continue;

      // Deduplicate by server name
      if (seen.has(entry.server.name)) continue;
      seen.add(entry.server.name);

      // Skip servers with no install method (no packages and no remotes)
      const hasPackage = entry.server.packages?.some(
        (p) => p.registryType === "npm",
      );
      const hasRemote = entry.server.remotes?.length;
      if (!hasPackage && !hasRemote) continue;

      items.push(serverToCatalogItem(entry));
    }

    if (!data.metadata.nextCursor || data.servers.length < PAGE_LIMIT) break;
    cursor = data.metadata.nextCursor;
  }

  // Sort alphabetically by name
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

/** Fetch all MCP servers from the official registry. Cached after first load. */
export function fetchRegistryServers(): Promise<CatalogItem[]> {
  if (registryCache) return Promise.resolve(registryCache);
  if (registryPromise) return registryPromise;

  registryPromise = _fetchAllServers()
    .then((items) => {
      registryCache = items;
      return items;
    })
    .catch((err) => {
      console.error("Failed to fetch MCP registry:", err);
      registryPromise = null;
      return [];
    });

  return registryPromise;
}

/** Search registry servers client-side */
export function searchRegistryServers(
  servers: CatalogItem[],
  query: string,
): CatalogItem[] {
  const q = query.toLowerCase();
  return servers.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.author.toLowerCase().includes(q) ||
      s.installRef.toLowerCase().includes(q),
  );
}

// Preload on import
fetchRegistryServers();
