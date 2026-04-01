import type { Session, Message, Part, Provider, AgentInfo } from "./types";
import { useServerStore } from "../stores/server-store";

let baseUrl: string | null = null;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function getBaseUrl(): string | null {
  return baseUrl;
}

function getDirectory(): string | undefined {
  return useServerStore.getState().directory || undefined;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const dir = getDirectory();
  if (dir) {
    headers["x-opencode-directory"] = dir;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error("Server not connected");

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: buildHeaders(options.headers as Record<string, string>),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
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
  return request("/session", {
    method: "POST",
    body: JSON.stringify({ permission }),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/session/${id}`, { method: "DELETE" });
}

export async function updateSession(
  id: string,
  updates: { title?: string; time?: { archived?: number } },
): Promise<Session> {
  return request(`/session/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function abortSession(id: string): Promise<void> {
  await request(`/session/${id}/abort`, { method: "POST" });
}

// Message API
// GET /session/:id/message returns MessageV2.WithParts[] = { info, parts }[]
export async function getMessages(
  sessionId: string,
): Promise<Array<{ info: Message; parts: Part[] }>> {
  return request(`/session/${sessionId}/message`);
}

// GET /session/:id/message/:messageId returns { info, parts }
export async function getMessageParts(
  sessionId: string,
  messageId: string,
): Promise<{ info: Message; parts: Part[] }> {
  return request(`/session/${sessionId}/message/${messageId}`);
}

// POST /session/:id/prompt_async sends a prompt and returns immediately (204)
export async function sendPrompt(
  sessionId: string,
  parts: Array<{ type: "text"; text: string }>,
  options?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
  },
): Promise<void> {
  await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      parts,
      ...options,
    }),
  });
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
): Promise<void> {
  await request(`/permission/${requestId}/reply`, {
    method: "POST",
    body: JSON.stringify({ reply }),
  });
}

// Agent API
export async function listAgents(): Promise<AgentInfo[]> {
  return request("/agent");
}

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    if (!baseUrl) return false;
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
