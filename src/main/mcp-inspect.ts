import { spawn, type ChildProcess } from "node:child_process";
import log from "electron-log";
import { readOpencodeConfig } from "./sidecar";

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPServerInfo {
  name: string;
  type: string;
  command?: string[];
  url?: string;
  tools: MCPTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
  error?: string;
}

// Simple JSON-RPC over stdio client for MCP
class MCPStdioClient {
  private proc: ChildProcess;
  private buffer = "";
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private nextId = 1;

  constructor(command: string[], env?: Record<string, string>) {
    const [cmd, ...args] = command;
    this.proc = spawn(cmd!, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      log.warn("MCP stderr:", chunk.toString().trim());
    });
  }

  private processBuffer(): void {
    // MCP uses Content-Length header framing (LSP-style)
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Try plain JSON line parsing as fallback
        const lineEnd = this.buffer.indexOf("\n");
        if (lineEnd === -1) break;
        const line = this.buffer.slice(0, lineEnd).trim();
        this.buffer = this.buffer.slice(lineEnd + 1);
        if (line) {
          try {
            this.handleMessage(JSON.parse(line));
          } catch {
            // skip
          }
        }
        continue;
      }

      const contentLength = parseInt(match[1]!, 10);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + contentLength) break;

      const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
      this.buffer = this.buffer.slice(bodyStart + contentLength);

      try {
        this.handleMessage(JSON.parse(body));
      } catch {
        // skip malformed
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const id = msg.id as number | undefined;
    if (id !== undefined && this.pending.has(id)) {
      const p = this.pending.get(id)!;
      this.pending.delete(id);
      if (msg.error) {
        p.reject(
          new Error(
            ((msg.error as Record<string, unknown>).message as string) ||
              "RPC error",
          ),
        );
      } else {
        p.resolve(msg.result);
      }
    }
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });

      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      const frame = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`;
      this.proc.stdin?.write(frame);

      // Timeout after 15s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("MCP request timeout"));
        }
      }, 15000);
    });
  }

  destroy(): void {
    for (const p of this.pending.values()) {
      p.reject(new Error("Client destroyed"));
    }
    this.pending.clear();
    this.proc.stdin?.end();
    this.proc.kill("SIGTERM");
    // Force kill after 2s
    setTimeout(() => {
      try {
        this.proc.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, 2000);
  }
}

async function introspectStdioServer(
  name: string,
  command: string[],
  env?: Record<string, string>,
): Promise<MCPServerInfo> {
  const info: MCPServerInfo = {
    name,
    type: "local",
    command,
    tools: [],
    prompts: [],
    resources: [],
  };

  let client: MCPStdioClient | undefined;
  try {
    client = new MCPStdioClient(command, env);

    // Initialize
    await client.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "opencowork", version: "1.0.0" },
    });

    // Send initialized notification (no response expected, but send as request with unique id)
    client.send("notifications/initialized", {}).catch(() => {});

    // Query capabilities in parallel
    const [toolsResult, promptsResult, resourcesResult] =
      await Promise.allSettled([
        client.send("tools/list", {}),
        client.send("prompts/list", {}),
        client.send("resources/list", {}),
      ]);

    if (toolsResult.status === "fulfilled" && toolsResult.value) {
      const r = toolsResult.value as { tools?: MCPTool[] };
      info.tools = r.tools || [];
    }
    if (promptsResult.status === "fulfilled" && promptsResult.value) {
      const r = promptsResult.value as { prompts?: MCPPrompt[] };
      info.prompts = r.prompts || [];
    }
    if (resourcesResult.status === "fulfilled" && resourcesResult.value) {
      const r = resourcesResult.value as { resources?: MCPResource[] };
      info.resources = r.resources || [];
    }
  } catch (err) {
    info.error = err instanceof Error ? err.message : String(err);
    log.warn(`MCP introspect failed for ${name}:`, err);
  } finally {
    client?.destroy();
  }

  return info;
}

// Cache to avoid re-spawning servers constantly
let cache: { data: MCPServerInfo[]; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export async function listMCPServers(): Promise<MCPServerInfo[]> {
  // Return cache if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const config = readOpencodeConfig();
  const mcp = config.mcp as Record<string, Record<string, unknown>> | undefined;

  if (!mcp) return [];

  const results = await Promise.all(
    Object.entries(mcp).map(async ([name, entry]) => {
      const type = (entry.type as string) || "local";
      const command = entry.command as string[] | undefined;
      const env = entry.env as Record<string, string> | undefined;
      const url = entry.url as string | undefined;

      if (type === "local" && command?.length) {
        return introspectStdioServer(name, command, env);
      }

      // For non-local types, return config only (no introspection yet)
      return {
        name,
        type,
        url,
        command,
        tools: [],
        prompts: [],
        resources: [],
        error:
          type !== "local"
            ? `Introspection not supported for type "${type}"`
            : undefined,
      } satisfies MCPServerInfo;
    }),
  );

  cache = { data: results, timestamp: Date.now() };
  return results;
}

export function clearMCPCache(): void {
  cache = null;
}
