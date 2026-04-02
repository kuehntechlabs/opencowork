export type CatalogCategory = "skills" | "connectors" | "plugins";
export type CatalogTab = "yours" | "shared" | "community";

export interface CatalogItem {
  name: string;
  author: string;
  description: string;
  downloads: number;
  category: CatalogCategory;
  tab: CatalogTab;
  /** For skills: github repo or path. For MCPs: npm package / command. For plugins: npm package. */
  installRef: string;
  /** For MCPs: the command array to add to config */
  mcpCommand?: string[];
  /** Tags for filtering */
  tags?: string[];
}

function k(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export function formatDownloads(n: number): string {
  return k(n);
}

// ── Skills Catalog ──────────────────────────────────────────────

const communitySkills: CatalogItem[] = [
  {
    name: "/skill-creator",
    author: "Anthropic",
    description:
      "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to crea...",
    downloads: 3100,
    category: "skills",
    tab: "community",
    installRef: "anthropic/skill-creator",
    tags: ["meta", "development"],
  },
  {
    name: "/canvas-design",
    author: "Anthropic",
    description:
      "Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this when t...",
    downloads: 32100,
    category: "skills",
    tab: "community",
    installRef: "anthropic/canvas-design",
    tags: ["design", "visual"],
  },
  {
    name: "/web-artifacts-builder",
    author: "Anthropic",
    description:
      "Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web...",
    downloads: 20200,
    category: "skills",
    tab: "community",
    installRef: "anthropic/web-artifacts-builder",
    tags: ["web", "frontend"],
  },
  {
    name: "/algorithmic-art",
    author: "Anthropic",
    description:
      "Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use...",
    downloads: 17800,
    category: "skills",
    tab: "community",
    installRef: "anthropic/algorithmic-art",
    tags: ["art", "creative"],
  },
  {
    name: "/doc-coauthoring",
    author: "Anthropic",
    description:
      "Guide users through a structured workflow for co-authoring documentation. Use when users want to write...",
    downloads: 16900,
    category: "skills",
    tab: "community",
    installRef: "anthropic/doc-coauthoring",
    tags: ["writing", "docs"],
  },
  {
    name: "/mcp-builder",
    author: "Anthropic",
    description:
      "Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with...",
    downloads: 16800,
    category: "skills",
    tab: "community",
    installRef: "anthropic/mcp-builder",
    tags: ["mcp", "development"],
  },
  {
    name: "/brand-guidelines",
    author: "Anthropic",
    description:
      "Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having...",
    downloads: 16200,
    category: "skills",
    tab: "community",
    installRef: "anthropic/brand-guidelines",
    tags: ["design", "branding"],
  },
  {
    name: "/theme-factory",
    author: "Anthropic",
    description:
      "Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc...",
    downloads: 16100,
    category: "skills",
    tab: "community",
    installRef: "anthropic/theme-factory",
    tags: ["design", "theming"],
  },
  {
    name: "/internal-comms",
    author: "Anthropic",
    description:
      "A set of resources to help me write all kinds of internal communications, using the formats that my company lik...",
    downloads: 12400,
    category: "skills",
    tab: "community",
    installRef: "anthropic/internal-comms",
    tags: ["writing", "communication"],
  },
  {
    name: "/slack-gif-creator",
    author: "Anthropic",
    description:
      "Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tool...",
    downloads: 9000,
    category: "skills",
    tab: "community",
    installRef: "anthropic/slack-gif-creator",
    tags: ["creative", "slack"],
  },
];

// ── MCP Connectors Catalog ──────────────────────────────────────

const communityConnectors: CatalogItem[] = [
  {
    name: "filesystem",
    author: "Anthropic",
    description:
      "Read, write, and manage files on the local filesystem. Provides tools for directory listing, file reading, writing, and searching.",
    downloads: 89400,
    category: "connectors",
    tab: "community",
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
    tab: "community",
    installRef: "@modelcontextprotocol/server-github",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-github"],
    tags: ["git", "code", "ci"],
  },
  {
    name: "postgres",
    author: "MCP Community",
    description:
      "Connect to PostgreSQL databases. Run queries, inspect schemas, list tables, and manage database operations safely.",
    downloads: 45200,
    category: "connectors",
    tab: "community",
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
    tab: "community",
    installRef: "@modelcontextprotocol/server-slack",
    mcpCommand: ["npx", "-y", "@modelcontextprotocol/server-slack"],
    tags: ["communication", "messaging"],
  },
  {
    name: "brave-search",
    author: "Brave",
    description:
      "Search the web using Brave Search API. Get real-time results with web and news search capabilities.",
    downloads: 34500,
    category: "connectors",
    tab: "community",
    installRef: "@anthropic/mcp-brave-search",
    mcpCommand: ["npx", "-y", "@anthropic/mcp-brave-search"],
    tags: ["search", "web"],
  },
  {
    name: "memory",
    author: "MCP Community",
    description:
      "Persistent memory using a local knowledge graph. Store and retrieve entities, relations, and observations across sessions.",
    downloads: 31200,
    category: "connectors",
    tab: "community",
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
    tab: "community",
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
    tab: "community",
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
    tab: "community",
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
    tab: "community",
    installRef: "@anthropic/mcp-fetch",
    mcpCommand: ["npx", "-y", "@anthropic/mcp-fetch"],
    tags: ["web", "http"],
  },
];

// ── Plugins Catalog ─────────────────────────────────────────────

const communityPlugins: CatalogItem[] = [
  {
    name: "prettier",
    author: "Prettier",
    description:
      "Opinionated code formatter. Supports JavaScript, TypeScript, CSS, HTML, JSON, Markdown, and many more languages.",
    downloads: 156000,
    category: "plugins",
    tab: "community",
    installRef: "prettier",
    tags: ["formatting", "code"],
  },
  {
    name: "eslint",
    author: "ESLint",
    description:
      "Find and fix problems in your JavaScript and TypeScript code. Configurable linting with hundreds of rules.",
    downloads: 142000,
    category: "plugins",
    tab: "community",
    installRef: "eslint",
    tags: ["linting", "code-quality"],
  },
  {
    name: "husky",
    author: "typicode",
    description:
      "Modern native Git hooks made easy. Automatically lint your commit messages, code, and run tests on commit.",
    downloads: 98400,
    category: "plugins",
    tab: "community",
    installRef: "husky",
    tags: ["git", "hooks"],
  },
  {
    name: "commitlint",
    author: "commitlint",
    description:
      "Lint commit messages to ensure they follow conventional commit format. Works great with husky for automated checks.",
    downloads: 67200,
    category: "plugins",
    tab: "community",
    installRef: "@commitlint/cli",
    tags: ["git", "linting"],
  },
  {
    name: "lint-staged",
    author: "lint-staged",
    description:
      "Run linters against staged git files. Only lint files that are about to be committed for faster workflows.",
    downloads: 89100,
    category: "plugins",
    tab: "community",
    installRef: "lint-staged",
    tags: ["git", "linting"],
  },
  {
    name: "changeset",
    author: "changesets",
    description:
      "Manage versioning and changelogs for multi-package repositories. Automate releases with conventional changelog generation.",
    downloads: 54300,
    category: "plugins",
    tab: "community",
    installRef: "@changesets/cli",
    tags: ["versioning", "release"],
  },
  {
    name: "tailwindcss",
    author: "Tailwind Labs",
    description:
      "A utility-first CSS framework packed with classes that can be composed to build any design, directly in your markup.",
    downloads: 134000,
    category: "plugins",
    tab: "community",
    installRef: "tailwindcss",
    tags: ["css", "styling"],
  },
  {
    name: "vitest",
    author: "Vitest",
    description:
      "Next generation testing framework powered by Vite. Blazing fast unit tests with native ESM, TypeScript, and JSX support.",
    downloads: 78600,
    category: "plugins",
    tab: "community",
    installRef: "vitest",
    tags: ["testing", "vite"],
  },
];

// ── Combined Catalog ────────────────────────────────────────────

export const CATALOG: CatalogItem[] = [
  ...communitySkills,
  ...communityConnectors,
  ...communityPlugins,
];

export function getCatalogItems(
  category: CatalogCategory,
  tab: CatalogTab,
): CatalogItem[] {
  return CATALOG.filter(
    (item) => item.category === category && item.tab === tab,
  ).sort((a, b) => b.downloads - a.downloads);
}
