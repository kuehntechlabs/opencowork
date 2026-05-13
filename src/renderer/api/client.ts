import type {
  Session,
  Message,
  Part,
  Provider,
  AgentInfo,
  PromptPartInput,
  FileDiff,
  MCPStatus,
  Todo,
  LspStatus,
} from "./types";
import { useServerStore } from "../stores/server-store";
import { ARTIFACT_SYSTEM_PROMPT } from "../utils/artifact-prompt";

let baseUrl: string | null = null;
let credentials: string | null = null;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function getBaseUrl(): string | null {
  return baseUrl;
}

export function setCredentials(password: string | null) {
  credentials = password;
}

export function getCredentials(): string | null {
  return credentials;
}

function getDirectory(): string | undefined {
  return useServerStore.getState().directory || undefined;
}

function buildHeaders(
  extra?: Record<string, string>,
  directory?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const dir = directory === undefined ? getDirectory() : directory || undefined;
  if (dir) {
    headers["x-opencode-directory"] = dir;
  }
  if (credentials) {
    headers["Authorization"] = "Basic " + btoa("opencode:" + credentials);
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  directory?: string | null,
): Promise<T> {
  if (!baseUrl) throw new Error("Server not connected");

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: buildHeaders(options.headers as Record<string, string>, directory),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// Session API
export async function listSessions(): Promise<Session[]> {
  return request("/session");
}

export async function getSession(id: string): Promise<Session> {
  return request(`/session/${id}`);
}

export async function createSession(
  directory: string,
  permissionAction: "allow" | "ask" = "ask",
): Promise<Session> {
  const permission =
    permissionAction === "allow"
      ? [{ permission: "*", pattern: "*", action: "allow" as const }]
      : undefined;
  return request(
    "/session",
    {
      method: "POST",
      body: JSON.stringify({ permission }),
    },
    directory,
  );
}

export async function deleteSession(
  id: string,
  directory?: string,
): Promise<void> {
  await request(`/session/${id}`, { method: "DELETE" }, directory);
}

/** List sessions scoped to a specific directory without changing the global scope. */
export async function listSessionsForDirectory(
  directory: string,
): Promise<Session[]> {
  return request("/session", {}, directory);
}

/** Delete a session while passing an explicit directory header. */
export async function deleteSessionInDirectory(
  id: string,
  directory: string,
): Promise<void> {
  if (!baseUrl) throw new Error("Server not connected");
  const res = await fetch(`${baseUrl}/session/${id}`, {
    method: "DELETE",
    headers: buildHeaders(undefined, directory),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function updateSession(
  id: string,
  updates: { title?: string; time?: { archived?: number } },
  directory?: string,
): Promise<Session> {
  return request(
    `/session/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
    directory,
  );
}

export async function abortSession(
  id: string,
  directory?: string,
): Promise<void> {
  await request(`/session/${id}/abort`, { method: "POST" }, directory);
}

// Message API
// GET /session/:id/message returns MessageV2.WithParts[] = { info, parts }[]
export async function getMessages(
  sessionId: string,
  directory?: string,
): Promise<Array<{ info: Message; parts: Part[] }>> {
  return request(`/session/${sessionId}/message`, {}, directory);
}

// GET /session/:id/message/:messageId returns { info, parts }
export async function getMessageParts(
  sessionId: string,
  messageId: string,
): Promise<{ info: Message; parts: Part[] }> {
  return request(`/session/${sessionId}/message/${messageId}`);
}

// Track which sessions have had artifact instructions injected
const injectedSessions = new Set<string>();

// POST /session/:id/prompt_async sends a prompt and returns immediately (204)
export async function sendPrompt(
  sessionId: string,
  parts: PromptPartInput[],
  options?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
    variant?: string;
  },
  directory?: string,
): Promise<void> {
  if (!baseUrl) throw new Error("Server not connected");
  // Inject artifact instructions on the first text part of each session
  let actualParts: PromptPartInput[] = parts;
  if (!injectedSessions.has(sessionId) && parts.length > 0) {
    injectedSessions.add(sessionId);
    let injected = false;
    actualParts = parts.map((p) => {
      if (!injected && p.type === "text") {
        injected = true;
        return { ...p, text: ARTIFACT_SYSTEM_PROMPT + p.text };
      }
      return p;
    });
  }

  const res = await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: buildHeaders(undefined, directory),
    body: JSON.stringify({
      parts: actualParts,
      ...options,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Prompt API error ${res.status}: ${text}`);
  }
}

// Provider API
export async function listProviders(): Promise<{
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
}> {
  return request("/provider");
}

// Permission API — POST /permission/:requestID/reply
export async function replyPermission(
  requestId: string,
  reply: "once" | "always" | "reject",
  directory?: string,
): Promise<void> {
  await request(
    `/permission/${requestId}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ reply }),
    },
    directory,
  );
}

// Session revert / unrevert (undo / redo)
export async function revertSession(
  sessionId: string,
  messageID: string,
  partID?: string,
  directory?: string,
): Promise<void> {
  await request(
    `/session/${sessionId}/revert`,
    {
      method: "POST",
      body: JSON.stringify(partID ? { messageID, partID } : { messageID }),
    },
    directory,
  );
}

export async function unrevertSession(
  sessionId: string,
  directory?: string,
): Promise<void> {
  await request(
    `/session/${sessionId}/unrevert`,
    { method: "POST" },
    directory,
  );
}

// Session summarize (compact)
export async function summarizeSession(
  sessionId: string,
  providerID: string,
  modelID: string,
  directory?: string,
): Promise<void> {
  await request(
    `/session/${sessionId}/summarize`,
    {
      method: "POST",
      body: JSON.stringify({ providerID, modelID }),
    },
    directory,
  );
}

// Session share / unshare
export async function shareSession(sessionId: string): Promise<string> {
  const res = await request<{ url: string }>(`/session/${sessionId}/share`, {
    method: "POST",
  });
  return res.url;
}

export async function unshareSession(sessionId: string): Promise<void> {
  await request(`/session/${sessionId}/unshare`, { method: "POST" });
}

// Agent API
export async function listAgents(): Promise<AgentInfo[]> {
  return request("/agent");
}

// Command API — lists custom commands (skills, MCPs, user-defined)
export interface CustomCommand {
  name: string;
  description: string;
  source: "skill" | "mcp" | "command";
}

export async function listCommands(): Promise<CustomCommand[]> {
  try {
    return await request<CustomCommand[]>("/command");
  } catch {
    return [];
  }
}

// Execute a custom command (skill/MCP) in a session
export async function executeCommand(
  sessionId: string,
  command: string,
  args: string,
  options?: {
    agent?: string;
    model?: string;
    variant?: string;
  },
  directory?: string,
): Promise<void> {
  if (!baseUrl) throw new Error("Server not connected");
  const res = await fetch(`${baseUrl}/session/${sessionId}/command`, {
    method: "POST",
    headers: buildHeaders(undefined, directory),
    body: JSON.stringify({
      command,
      arguments: args,
      ...options,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Command API error ${res.status}: ${text}`);
  }
}

// Skill API — lists all available skills with their info
export interface SkillInfo {
  name: string;
  description: string;
  location: string;
  content: string;
}

export async function listSkills(): Promise<SkillInfo[]> {
  try {
    return await request<SkillInfo[]>("/skill");
  } catch {
    return [];
  }
}

// Reply to a question asked by the model via the `question` tool
export async function replyQuestion(
  requestId: string,
  answers: string[][],
  directory?: string,
): Promise<void> {
  if (!baseUrl) throw new Error("Server not connected");
  const res = await fetch(`${baseUrl}/question/${requestId}/reply`, {
    method: "POST",
    headers: buildHeaders(undefined, directory),
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Question API error ${res.status}: ${text}`);
  }
}

// MCP status — map of server name to status
export async function getMCPStatus(): Promise<Record<string, MCPStatus>> {
  try {
    return await request<Record<string, MCPStatus>>(`/mcp`);
  } catch {
    return {};
  }
}

// LSP status — list of language servers and their connectivity
export async function getLspStatus(): Promise<LspStatus[]> {
  try {
    return await request<LspStatus[]>(`/lsp`);
  } catch {
    return [];
  }
}

// Session todos — the in-session todo list
export async function getTodos(
  sessionId: string,
  directory?: string,
): Promise<Todo[]> {
  try {
    return await request<Todo[]>(`/session/${sessionId}/todo`, {}, directory);
  } catch {
    return [];
  }
}

// Session diff — cumulative file changes for the session
export async function getSessionDiff(
  sessionId: string,
  directory?: string,
): Promise<FileDiff[]> {
  try {
    return await request<FileDiff[]>(
      `/session/${sessionId}/diff`,
      {},
      directory,
    );
  } catch {
    return [];
  }
}

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    if (!baseUrl) return false;
    const res = await fetch(`${baseUrl}/health`, {
      headers: buildHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
