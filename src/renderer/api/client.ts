import type { Session, Message, Part, Provider } from "./types";

let baseUrl: string | null = null;

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function getBaseUrl(): string | null {
  return baseUrl;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  directory?: string,
): Promise<T> {
  if (!baseUrl) throw new Error("Server not connected");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (directory) {
    headers["x-opencode-directory"] = directory;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

// Session API
export async function listSessions(directory?: string): Promise<Session[]> {
  return request("/session", {}, directory);
}

export async function getSession(id: string): Promise<Session> {
  return request(`/session/${id}`);
}

export async function createSession(directory: string): Promise<Session> {
  return request(
    "/session",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    directory,
  );
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/session/${id}`, { method: "DELETE" });
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

// POST /session/:id/message sends a prompt (streaming response)
// POST /session/:id/prompt_async sends a prompt and returns immediately (204)
export async function sendPrompt(
  sessionId: string,
  parts: Array<{ type: "text"; text: string }>,
  options?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
  },
): Promise<void> {
  // Use prompt_async so we don't block on the streaming response
  // SSE events will deliver the response parts
  await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts,
      ...options,
    }),
  });
}

// Provider API
export async function listProviders(directory?: string): Promise<{
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
}> {
  return request("/provider", {}, directory);
}

// Permission API
export async function replyPermission(
  sessionId: string,
  requestId: string,
  reply: "once" | "always" | "reject",
): Promise<void> {
  await request(`/session/${sessionId}/permission/${requestId}`, {
    method: "POST",
    body: JSON.stringify({ reply }),
  });
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
