export type CatalogCategory = "skills" | "connectors" | "plugins";

export interface CatalogItem {
  name: string;
  author: string;
  description: string;
  downloads: number;
  category: CatalogCategory;
  /** Install command or ref */
  installRef: string;
  /** For MCPs: the command array to add to config */
  mcpCommand?: string[];
  /** For MCPs: required environment variables { VAR_NAME: "description" } */
  mcpEnv?: Record<string, string>;
  /** For remote MCPs: the server URL */
  mcpUrl?: string;
  /** For remote MCPs: transport type (e.g. "streamable-http", "sse") */
  mcpTransport?: string;
  /** For remote MCPs: required headers { HeaderName: "description" } */
  mcpHeaders?: Record<string, string>;
  /** Tags for filtering */
  tags?: string[];
  /** Logo/icon URL (e.g. GitHub avatar) */
  iconUrl?: string;
  /** Number of skills inside (for plugin collections) */
  skillCount?: number;
  /** Website URL for the server */
  websiteUrl?: string;
  /** Version string */
  version?: string;
}

function k(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export function formatDownloads(n: number): string {
  return k(n);
}

// ── Static MCP Connectors Catalog ───────────────────────────────

export const CONNECTORS: CatalogItem[] = [
  {
    name: "filesystem",
    author: "Anthropic",
    description:
      "Read, write, and manage files on the local filesystem. Provides tools for directory listing, file reading, writing, and searching.",
    downloads: 89400,
    category: "connectors",
    installRef: "@anthropic/mcp-filesystem",
    mcpCommand: ["npx", "-y", "@anthropic/mcp-filesystem"],
    tags: ["files", "core"],
  },
  {
    name: "github",
    author: "GitHub",
    description:
      "Interact with GitHub repositories, issues, pull requests, and more. Search code, manage branches, and automate workflows.",
    downloads: 72100,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-github",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-github"],
    mcpEnv: { GITHUB_PERSONAL_ACCESS_TOKEN: "GitHub personal access token" },
    tags: ["git", "code", "ci"],
  },
  {
    name: "postgres",
    author: "MCP Community",
    description:
      "Connect to PostgreSQL databases. Run queries, inspect schemas, list tables, and manage database operations safely.",
    downloads: 45200,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-postgres",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-postgres"],
    tags: ["database", "sql"],
  },
  {
    name: "slack",
    author: "MCP Community",
    description:
      "Send and read Slack messages, manage channels, search message history, and interact with Slack workspaces.",
    downloads: 38700,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-slack",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-slack"],
    mcpEnv: {
      SLACK_BOT_TOKEN: "Slack bot token",
      SLACK_TEAM_ID: "Slack team/workspace ID",
    },
    tags: ["communication", "messaging"],
  },
  {
    name: "brave-search",
    author: "Brave",
    description:
      "Search the web using Brave Search API. Get real-time results with web and news search capabilities.",
    downloads: 34500,
    category: "connectors",
    installRef: "@anthropic/mcp-brave-search",
    mcpCommand: ["npx", "-y", "@anthropic/mcp-brave-search"],
    mcpEnv: { BRAVE_API_KEY: "Brave Search API key" },
    tags: ["search", "web"],
  },
  {
    name: "memory",
    author: "MCP Community",
    description:
      "Persistent memory using a local knowledge graph. Store and retrieve entities, relations, and observations across sessions.",
    downloads: 31200,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-memory",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-memory"],
    tags: ["memory", "knowledge"],
  },
  {
    name: "puppeteer",
    author: "MCP Community",
    description:
      "Browser automation via Puppeteer. Navigate pages, take screenshots, click elements, fill forms, and execute JavaScript.",
    downloads: 28900,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-puppeteer",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-puppeteer"],
    tags: ["browser", "automation"],
  },
  {
    name: "gitnexus",
    author: "GitNexus",
    description:
      "Advanced Git operations and repository analysis. Diff, blame, log, and semantic code search across your projects.",
    downloads: 24100,
    category: "connectors",
    installRef: "gitnexus@latest",
    mcpCommand: ["npx", "-y", "gitnexus@latest", "mcp"],
    tags: ["git", "code"],
  },
  {
    name: "sqlite",
    author: "MCP Community",
    description:
      "Connect to SQLite databases. Run queries, create tables, inspect schemas, and manage local database files.",
    downloads: 22300,
    category: "connectors",
    installRef: "@modelcontextprotocol/server-sqlite",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-sqlite"],
    tags: ["database", "sql"],
  },
  {
    name: "fetch",
    author: "MCP Community",
    description:
      "Fetch content from URLs. Retrieve web pages, APIs, and other HTTP resources with configurable headers and methods.",
    downloads: 19800,
    category: "connectors",
    installRef: "@anthropic/mcp-fetch",
    mcpCommand: ["npx", "-y", "@anthropic/mcp-fetch"],
    tags: ["web", "http"],
  },
];
