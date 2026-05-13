import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import log from "electron-log";
import { writeMCPConfig, removeMCPConfig } from "./server";

const execFileAsync = promisify(execFile);

// ── Paths ────────────────────────────────────────────────────────

const PLUGINS_DIR = join(homedir(), ".claude", "plugins");
const SKILLS_DIR = join(homedir(), ".claude", "skills");
const REGISTRY_PATH = join(PLUGINS_DIR, "installed.json");

// ── Types ────────────────────────────────────────────────────────

export type PluginFormat = "claude" | "codex";

export type PluginSource =
  | { type: "github"; repo: string; ref?: string }
  | { type: "url"; url: string; ref?: string }
  | { type: "local"; path: string };

export interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: { name?: string; email?: string; url?: string } | string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}

export interface PluginComponentItem {
  name: string;
  /** Path relative to plugin root */
  path: string;
  description?: string;
}

export interface PluginComponents {
  skills: PluginComponentItem[];
  mcpServers: { name: string; config: Record<string, unknown> }[];
  agents: PluginComponentItem[];
  commands: PluginComponentItem[];
  hooks: PluginComponentItem[];
  lsp: PluginComponentItem[];
  monitors: PluginComponentItem[];
}

export interface InstalledPlugin {
  name: string;
  source: PluginSource;
  installedAt: number;
  format: PluginFormat;
  manifest: PluginManifest;
  /** Absolute path to where the plugin manifest lives (clone dir + subdir, or user's local folder + subdir) */
  installDir: string;
  /** When set, `installDir` is a subdirectory of this cloned repo. Uninstall deletes cloneRoot. */
  cloneRoot?: string;
  /** Subdirectory inside the source where the plugin lives (for git-subdir / local-with-subdir sources) */
  subdir?: string;
  /** Name of the marketplace this plugin came from, if any */
  marketplaceName?: string;
  /** Skill directory names created under ~/.claude/skills */
  mirroredSkills: string[];
  /** MCP server keys written into opencode config */
  mergedMcpKeys: string[];
  components: {
    skills: number;
    mcpServers: number;
    agents: number;
    commands: number;
    hooks: number;
    lsp: number;
    monitors: number;
  };
}

interface Registry {
  version: 1;
  plugins: Record<string, InstalledPlugin>;
}

export interface InstallSummary {
  ok: true;
  plugin: InstalledPlugin;
  inventory: PluginComponents;
}

export interface InstallError {
  ok: false;
  error: string;
}

export type InstallResult = InstallSummary | InstallError;

// ── Registry I/O ─────────────────────────────────────────────────

function readRegistry(): Registry {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, plugins: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
    if (parsed && typeof parsed === "object" && parsed.plugins) {
      return parsed as Registry;
    }
    return { version: 1, plugins: {} };
  } catch (err) {
    log.warn("Corrupt plugins registry, resetting:", err);
    return { version: 1, plugins: {} };
  }
}

function writeRegistry(reg: Registry): void {
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + "\n", "utf-8");
}

export function listInstalledPlugins(): InstalledPlugin[] {
  return Object.values(readRegistry().plugins).sort(
    (a, b) => b.installedAt - a.installedAt,
  );
}

// ── Manifest parsing ─────────────────────────────────────────────

export function readPluginManifest(
  rootDir: string,
): { manifest: PluginManifest; format: PluginFormat } | null {
  const candidates: { path: string; format: PluginFormat }[] = [
    { path: join(rootDir, ".claude-plugin", "plugin.json"), format: "claude" },
    { path: join(rootDir, ".codex-plugin", "plugin.json"), format: "codex" },
  ];
  for (const { path, format } of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      if (raw && typeof raw === "object" && typeof raw.name === "string") {
        return { manifest: raw as PluginManifest, format };
      }
    } catch (err) {
      log.warn(`Failed to parse manifest at ${path}:`, err);
    }
  }
  return null;
}

// ── Component inventory ─────────────────────────────────────────

function safeListDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function safeListFiles(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isFile() &&
          !e.name.startsWith(".") &&
          exts.some((ext) => e.name.toLowerCase().endsWith(ext)),
      )
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function readFrontmatterDescription(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(
      /^---[\s\S]*?description:\s*(.+?)[\s\r\n]/m,
    );
    return match ? match[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

export function inventoryPluginComponents(rootDir: string): PluginComponents {
  const result: PluginComponents = {
    skills: [],
    mcpServers: [],
    agents: [],
    commands: [],
    hooks: [],
    lsp: [],
    monitors: [],
  };

  // Skills: skills/<name>/SKILL.md
  const skillsDir = join(rootDir, "skills");
  for (const name of safeListDirs(skillsDir)) {
    const skillMd = join(skillsDir, name, "SKILL.md");
    if (existsSync(skillMd)) {
      result.skills.push({
        name,
        path: join("skills", name),
        description: readFrontmatterDescription(skillMd),
      });
    }
  }

  // MCP servers: .mcp.json → object under "mcpServers" or top-level map
  const mcpPath = join(rootDir, ".mcp.json");
  if (existsSync(mcpPath)) {
    try {
      const raw = JSON.parse(readFileSync(mcpPath, "utf-8"));
      const servers: Record<string, unknown> =
        (raw && typeof raw === "object" && raw.mcpServers) || raw || {};
      for (const [name, config] of Object.entries(servers)) {
        if (config && typeof config === "object") {
          result.mcpServers.push({
            name,
            config: config as Record<string, unknown>,
          });
        }
      }
    } catch (err) {
      log.warn(`Failed to parse .mcp.json at ${mcpPath}:`, err);
    }
  }

  // Agents: agents/*.md
  const agentsDir = join(rootDir, "agents");
  for (const fileName of safeListFiles(agentsDir, [".md"])) {
    const filePath = join(agentsDir, fileName);
    result.agents.push({
      name: fileName.replace(/\.md$/i, ""),
      path: join("agents", fileName),
      description: readFrontmatterDescription(filePath),
    });
  }

  // Commands: commands/*.md (flat markdown files)
  const commandsDir = join(rootDir, "commands");
  for (const fileName of safeListFiles(commandsDir, [".md"])) {
    const filePath = join(commandsDir, fileName);
    result.commands.push({
      name: fileName.replace(/\.md$/i, ""),
      path: join("commands", fileName),
      description: readFrontmatterDescription(filePath),
    });
  }

  // Hooks: hooks/hooks.json
  const hooksPath = join(rootDir, "hooks", "hooks.json");
  if (existsSync(hooksPath)) {
    try {
      const raw = JSON.parse(readFileSync(hooksPath, "utf-8"));
      const hookGroups = (raw?.hooks || {}) as Record<string, unknown[]>;
      for (const [event, entries] of Object.entries(hookGroups)) {
        const count = Array.isArray(entries) ? entries.length : 0;
        if (count > 0) {
          result.hooks.push({
            name: event,
            path: join("hooks", "hooks.json"),
            description: `${count} handler${count !== 1 ? "s" : ""}`,
          });
        }
      }
    } catch (err) {
      log.warn(`Failed to parse hooks.json at ${hooksPath}:`, err);
    }
  }

  // LSP: .lsp.json
  const lspPath = join(rootDir, ".lsp.json");
  if (existsSync(lspPath)) {
    try {
      const raw = JSON.parse(readFileSync(lspPath, "utf-8"));
      for (const [lang, cfg] of Object.entries(raw || {})) {
        const desc =
          cfg && typeof cfg === "object" && (cfg as { command?: string }).command
            ? `command: ${(cfg as { command: string }).command}`
            : undefined;
        result.lsp.push({
          name: lang,
          path: ".lsp.json",
          description: desc,
        });
      }
    } catch (err) {
      log.warn(`Failed to parse .lsp.json at ${lspPath}:`, err);
    }
  }

  // Monitors: monitors/monitors.json
  const monitorsPath = join(rootDir, "monitors", "monitors.json");
  if (existsSync(monitorsPath)) {
    try {
      const raw = JSON.parse(readFileSync(monitorsPath, "utf-8"));
      const list = Array.isArray(raw) ? raw : [];
      for (const m of list) {
        if (m && typeof m === "object" && typeof m.name === "string") {
          result.monitors.push({
            name: m.name,
            path: join("monitors", "monitors.json"),
            description: (m as { description?: string }).description,
          });
        }
      }
    } catch (err) {
      log.warn(`Failed to parse monitors.json at ${monitorsPath}:`, err);
    }
  }

  return result;
}

// ── Git operations ───────────────────────────────────────────────

function normalizeRepo(input: string): string {
  const trimmed = input.trim();
  // Full URL already
  if (/^(https?:\/\/|git@|ssh:\/\/)/i.test(trimmed)) return trimmed;
  // owner/repo shorthand
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

// ── Install / uninstall ─────────────────────────────────────────

export async function installPluginFromSource(
  source: PluginSource,
  opts: {
    overwrite?: boolean;
    /** Subdirectory inside the source (clone root or local folder) that contains the plugin */
    subdir?: string;
    /** Marketplace name, if this install was triggered from a marketplace */
    marketplaceName?: string;
  } = {},
): Promise<InstallResult> {
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });

  const normalizedSubdir = opts.subdir?.replace(/^\.?\/+/, "").replace(/\/+$/, "");

  // Step 1: resolve source to a rootDir (clone root or local folder root)
  //   and a pluginDir (where the manifest lives; may be a subdir of rootDir)
  let rootDir: string;
  let cleanupOnFail: string | null = null;

  if (source.type === "local") {
    if (!existsSync(source.path) || !statSync(source.path).isDirectory()) {
      return { ok: false, error: `Folder does not exist: ${source.path}` };
    }
    rootDir = source.path;
  } else {
    const url =
      source.type === "github" ? normalizeRepo(source.repo) : source.url;
    // Clone into a temp dir first; rename once we know the plugin name
    const tmpDest = join(PLUGINS_DIR, `.tmp-${Date.now()}`);
    const cloneResult = await gitClone(url, tmpDest, source.ref);
    if (!cloneResult.ok) {
      return { ok: false, error: `git clone failed: ${cloneResult.error}` };
    }
    rootDir = tmpDest;
    cleanupOnFail = tmpDest;
  }

  const pluginDirInRoot = normalizedSubdir
    ? join(rootDir, normalizedSubdir)
    : rootDir;

  try {
    // Step 2: parse manifest (at pluginDirInRoot)
    if (!existsSync(pluginDirInRoot) || !statSync(pluginDirInRoot).isDirectory()) {
      if (cleanupOnFail) rmSync(cleanupOnFail, { recursive: true, force: true });
      return {
        ok: false,
        error: `Plugin subdirectory does not exist: ${normalizedSubdir}`,
      };
    }
    const parsed = readPluginManifest(pluginDirInRoot);
    if (!parsed) {
      if (cleanupOnFail) rmSync(cleanupOnFail, { recursive: true, force: true });
      return {
        ok: false,
        error:
          "No plugin manifest found. Expected .claude-plugin/plugin.json or .codex-plugin/plugin.json.",
      };
    }
    const { manifest, format } = parsed;
    const pluginName = manifest.name.replace(/[^a-zA-Z0-9_-]/g, "-");
    if (!pluginName) {
      if (cleanupOnFail) rmSync(cleanupOnFail, { recursive: true, force: true });
      return { ok: false, error: "Plugin manifest has an invalid name." };
    }

    // Step 3: check for existing install
    const reg = readRegistry();
    if (reg.plugins[pluginName] && !opts.overwrite) {
      if (cleanupOnFail) rmSync(cleanupOnFail, { recursive: true, force: true });
      return {
        ok: false,
        error: `Plugin "${pluginName}" is already installed. Remove it first to reinstall.`,
      };
    }

    // Step 4: move cloned rootDir into final location.
    // For direct local installs (no marketplace), we reference the user's folder in place
    // so they can iterate without re-installing. For marketplace-sourced local installs we
    // copy so the installed plugin isn't tied to the marketplace's lifecycle.
    let finalRootDir: string;
    let cloneRootForRegistry: string | undefined;
    let installDir: string;
    const isMarketplaceLocal =
      source.type === "local" && Boolean(opts.marketplaceName);

    if (source.type === "local" && !isMarketplaceLocal) {
      installDir = pluginDirInRoot;
    } else if (isMarketplaceLocal) {
      // Copy just the plugin subtree to a self-contained dir; drop the subdir.
      finalRootDir = join(PLUGINS_DIR, pluginName);
      if (existsSync(finalRootDir)) {
        rmSync(finalRootDir, { recursive: true, force: true });
      }
      cpSync(pluginDirInRoot, finalRootDir, { recursive: true });
      cleanupOnFail = finalRootDir;
      cloneRootForRegistry = finalRootDir;
      installDir = finalRootDir;
    } else {
      finalRootDir = join(PLUGINS_DIR, pluginName);
      if (existsSync(finalRootDir)) {
        rmSync(finalRootDir, { recursive: true, force: true });
      }
      cpSync(rootDir, finalRootDir, { recursive: true });
      rmSync(rootDir, { recursive: true, force: true });
      cleanupOnFail = finalRootDir;
      cloneRootForRegistry = finalRootDir;
      installDir = normalizedSubdir
        ? join(finalRootDir, normalizedSubdir)
        : finalRootDir;
    }

    // Step 5: inventory components
    const inventory = inventoryPluginComponents(installDir);

    // Step 6: install skills (mirror into ~/.claude/skills/<plugin>__<skill>/)
    if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
    const mirroredSkills: string[] = [];
    for (const skill of inventory.skills) {
      const mirrorName = `${pluginName}__${skill.name}`;
      const dest = join(SKILLS_DIR, mirrorName);
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      cpSync(join(installDir, skill.path), dest, { recursive: true });
      mirroredSkills.push(mirrorName);
    }

    // Step 7: install MCP servers (merge into opencode config)
    const mergedMcpKeys: string[] = [];
    if (inventory.mcpServers.length > 0) {
      const mcpEntries: Record<string, unknown> = {};
      for (const { name, config } of inventory.mcpServers) {
        const key = `${pluginName}__${name}`;
        mcpEntries[key] = config;
        mergedMcpKeys.push(key);
      }
      try {
        writeMCPConfig(mcpEntries);
      } catch (err) {
        log.warn("Failed to merge plugin MCP servers:", err);
      }
    }

    // Step 8: record in registry
    const entry: InstalledPlugin = {
      name: pluginName,
      source,
      installedAt: Date.now(),
      format,
      manifest,
      installDir,
      cloneRoot: cloneRootForRegistry,
      // Marketplace-local installs flatten the subtree, so no subdir remains.
      subdir: isMarketplaceLocal ? undefined : normalizedSubdir || undefined,
      marketplaceName: opts.marketplaceName,
      mirroredSkills,
      mergedMcpKeys,
      components: {
        skills: inventory.skills.length,
        mcpServers: inventory.mcpServers.length,
        agents: inventory.agents.length,
        commands: inventory.commands.length,
        hooks: inventory.hooks.length,
        lsp: inventory.lsp.length,
        monitors: inventory.monitors.length,
      },
    };
    reg.plugins[pluginName] = entry;
    writeRegistry(reg);

    log.info(
      `Installed plugin "${pluginName}" (${format}): ${mirroredSkills.length} skills, ${mergedMcpKeys.length} MCP servers`,
    );

    return { ok: true, plugin: entry, inventory };
  } catch (err: unknown) {
    if (cleanupOnFail && existsSync(cleanupOnFail)) {
      try {
        rmSync(cleanupOnFail, { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export interface RemoveResult {
  ok: boolean;
  error?: string;
}

export function removePlugin(name: string): RemoveResult {
  const reg = readRegistry();
  const entry = reg.plugins[name];
  if (!entry) return { ok: false, error: `Plugin "${name}" is not installed.` };

  // Un-mirror skills
  for (const mirrorName of entry.mirroredSkills) {
    const dir = join(SKILLS_DIR, mirrorName);
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        log.warn(`Failed to remove mirrored skill ${dir}:`, err);
      }
    }
  }

  // Remove merged MCP entries
  for (const key of entry.mergedMcpKeys) {
    try {
      removeMCPConfig(key);
    } catch (err) {
      log.warn(`Failed to remove MCP config ${key}:`, err);
    }
  }

  // Delete the plugin's on-disk copy when we own it. `cloneRoot` is set for any
  // install that copied files into ~/.claude/plugins/ (cloned repos and
  // marketplace-local copies). User-provided local folders have no cloneRoot
  // and we leave them alone.
  if (entry.cloneRoot && existsSync(entry.cloneRoot)) {
    try {
      rmSync(entry.cloneRoot, { recursive: true, force: true });
    } catch (err) {
      log.warn(`Failed to remove plugin dir ${entry.cloneRoot}:`, err);
    }
  }

  delete reg.plugins[name];
  writeRegistry(reg);
  log.info(`Removed plugin "${name}"`);
  return { ok: true };
}
