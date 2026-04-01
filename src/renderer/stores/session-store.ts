import { create } from "zustand";
import type {
  Session,
  Message,
  Part,
  SessionStatus,
  PermissionRequest,
} from "../api/types";
import * as api from "../api/client";

interface SessionState {
  sessions: Record<string, Session>;
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  parts: Record<string, Part[]>;
  sessionStatus: Record<string, SessionStatus>;
  permissionRequests: Record<string, PermissionRequest>;
  loading: boolean;

  // Actions
  setActiveSession: (id: string | null) => void;
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  createSession: (
    directory: string,
    permissionAction?: "allow" | "ask",
  ) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  sendPrompt: (
    sessionId: string,
    text: string,
    options?: {
      model?: { providerID: string; modelID: string };
      agent?: string;
    },
  ) => Promise<void>;
  abortSession: (id: string) => Promise<void>;

  // SSE event handlers
  upsertSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setSessionStatus: (id: string, status: SessionStatus) => void;
  upsertMessage: (sessionId: string, message: Message) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  upsertPart: (sessionId: string, part: Part) => void;
  removePart: (sessionId: string, messageId: string, partId: string) => void;
  applyDelta: (
    sessionId: string,
    messageId: string,
    partId: string,
    field: string,
    delta: string,
  ) => void;
  addPermissionRequest: (request: PermissionRequest) => void;
  removePermissionRequest: (requestId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  messages: {},
  parts: {},
  sessionStatus: {},
  permissionRequests: {},
  loading: false,

  setActiveSession: (id) => {
    set({ activeSessionId: id });
    if (id) {
      get().loadMessages(id);
    }
  },

  loadSessions: async () => {
    set({ loading: true });
    try {
      const list = await api.listSessions();
      const sessions: Record<string, Session> = {};
      for (const s of list) {
        sessions[s.id] = s;
      }
      set({ sessions, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  loadMessages: async (sessionId) => {
    try {
      // API returns { info: Message, parts: Part[] }[]
      const response = await api.getMessages(sessionId);
      // Handle both array and object responses
      const withParts = Array.isArray(response) ? response : [];
      const msgs: Message[] = [];
      const allParts: Record<string, Part[]> = {};

      for (const item of withParts) {
        // Handle both { info, parts } and flat message formats
        const msg = item.info ?? item;
        const parts = item.parts ?? [];
        msgs.push(msg);
        if (parts.length) {
          allParts[msg.id] = parts;
        }
      }

      set((s) => ({
        messages: { ...s.messages, [sessionId]: msgs },
        parts: { ...s.parts, ...allParts },
      }));
    } catch (err) {
      console.error("Failed to load messages for session", sessionId, err);
    }
  },

  createSession: async (directory, permissionAction) => {
    const session = await api.createSession(directory, permissionAction);
    set((s) => ({
      sessions: { ...s.sessions, [session.id]: session },
      activeSessionId: session.id,
    }));
    return session;
  },

  deleteSession: async (id) => {
    await api.deleteSession(id);
    set((s) => {
      const { [id]: _, ...rest } = s.sessions;
      return {
        sessions: rest,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    });
  },

  sendPrompt: async (sessionId, text, options) => {
    await api.sendPrompt(sessionId, [{ type: "text", text }], options);
  },

  abortSession: async (id) => {
    await api.abortSession(id);
  },

  // SSE handlers
  upsertSession: (session) =>
    set((s) => ({
      sessions: { ...s.sessions, [session.id]: session },
    })),

  removeSession: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.sessions;
      return {
        sessions: rest,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    }),

  setSessionStatus: (id, status) =>
    set((s) => ({
      sessionStatus: { ...s.sessionStatus, [id]: status },
    })),

  upsertMessage: (sessionId, message) =>
    set((s) => {
      const msgs = s.messages[sessionId] || [];
      const idx = msgs.findIndex((m) => m.id === message.id);
      const updated =
        idx >= 0
          ? msgs.map((m, i) => (i === idx ? message : m))
          : [...msgs, message];
      return { messages: { ...s.messages, [sessionId]: updated } };
    }),

  removeMessage: (sessionId, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: (s.messages[sessionId] || []).filter(
          (m) => m.id !== messageId,
        ),
      },
    })),

  upsertPart: (sessionId, part) =>
    set((s) => {
      const msgParts = s.parts[part.messageID] || [];
      const idx = msgParts.findIndex((p) => p.id === part.id);
      const updated =
        idx >= 0
          ? msgParts.map((p, i) => (i === idx ? part : p))
          : [...msgParts, part];
      return { parts: { ...s.parts, [part.messageID]: updated } };
    }),

  removePart: (sessionId, messageId, partId) =>
    set((s) => ({
      parts: {
        ...s.parts,
        [messageId]: (s.parts[messageId] || []).filter((p) => p.id !== partId),
      },
    })),

  applyDelta: (sessionId, messageId, partId, field, delta) =>
    set((s) => {
      const msgParts = s.parts[messageId] || [];
      const existing = msgParts.find((p) => p.id === partId);

      if (!existing) {
        // Part doesn't exist yet — create a placeholder text part
        if (field === "text") {
          const newPart = {
            id: partId,
            sessionID: sessionId,
            messageID: messageId,
            type: "text" as const,
            text: delta,
          };
          return {
            parts: {
              ...s.parts,
              [messageId]: [...msgParts, newPart],
            },
          };
        }
        return {};
      }

      return {
        parts: {
          ...s.parts,
          [messageId]: msgParts.map((p) => {
            if (p.id !== partId) return p;
            if (field === "text" && "text" in p) {
              return { ...p, text: (p as { text: string }).text + delta };
            }
            return p;
          }),
        },
      };
    }),

  addPermissionRequest: (request) =>
    set((s) => ({
      permissionRequests: { ...s.permissionRequests, [request.id]: request },
    })),

  removePermissionRequest: (requestId) =>
    set((s) => {
      const { [requestId]: _, ...rest } = s.permissionRequests;
      return { permissionRequests: rest };
    }),
}));
