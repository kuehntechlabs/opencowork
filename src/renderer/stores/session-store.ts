import { create } from "zustand";
import type {
  Session,
  Message,
  Part,
  SessionStatus,
  PermissionRequest,
  PromptPartInput,
  Todo,
  FileDiff,
  QuestionRequest,
  MCPStatus,
  LspStatus,
  Provider,
} from "../api/types";
import * as api from "../api/client";
import { useSettingsStore } from "./settings-store";
import { useArtifactStore } from "./artifact-store";
import { useServerStore } from "./server-store";

function withDirectory(session: Session, directory?: string): Session {
  return session.directory || !directory ? session : { ...session, directory };
}

function getSessionDirectory(
  state: Pick<SessionState, "sessions" | "sessionDirectories">,
  sessionId: string,
): string | undefined {
  return (
    state.sessions[sessionId]?.directory || state.sessionDirectories[sessionId]
  );
}

interface SessionState {
  sessions: Record<string, Session>;
  sessionDirectories: Record<string, string>;
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  parts: Record<string, Part[]>;
  sessionStatus: Record<string, SessionStatus>;
  permissionRequests: Record<string, PermissionRequest>;
  todos: Record<string, Todo[]>;
  sessionDiffs: Record<string, FileDiff[]>;
  /** Pending model questions keyed by sessionId → callID */
  pendingQuestions: Record<string, Record<string, QuestionRequest>>;
  mcpStatus: Record<string, MCPStatus>;
  lspStatus: LspStatus[];
  providers: Provider[];
  /** Maps messageId → "/command" display text for command-originated messages */
  commandMessages: Record<string, string>;
  _pendingCommands: Record<string, string>;
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
  deleteSessionsForDirectory: (directory: string) => Promise<number>;
  findOrphanSessions: () => Promise<
    { directory: string; sessionIds: string[]; titles: string[] }[]
  >;
  cleanupOrphanSessions: () => Promise<number>;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;
  sendPrompt: (
    sessionId: string,
    parts: PromptPartInput[],
    options?: {
      model?: { providerID: string; modelID: string };
      agent?: string;
      variant?: string;
    },
  ) => Promise<void>;
  abortSession: (id: string) => Promise<void>;

  // SSE event handlers
  upsertSession: (session: Session, directory?: string) => void;
  removeSession: (id: string) => void;
  rememberSessionDirectory: (id: string, directory?: string) => void;
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
  upsertTodos: (sessionId: string, todos: Todo[]) => void;
  loadTodos: (sessionId: string) => Promise<void>;
  loadSessionDiff: (sessionId: string) => Promise<void>;
  upsertPendingQuestion: (request: QuestionRequest) => void;
  clearPendingQuestion: (sessionId: string, requestId: string) => void;
  loadMcpStatus: () => Promise<void>;
  loadLspStatus: () => Promise<void>;
  loadProviders: () => Promise<void>;
  /** Track that a command was sent, so the next user message can show the command name */
  setPendingCommand: (sessionId: string, commandName: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  sessionDirectories: {},
  activeSessionId: null,
  messages: {},
  parts: {},
  sessionStatus: {},
  permissionRequests: {},
  todos: {},
  sessionDiffs: {},
  pendingQuestions: {},
  mcpStatus: {},
  lspStatus: [],
  providers: [],
  commandMessages: {},
  _pendingCommands: {},
  loading: false,

  setActiveSession: (id) => {
    set({ activeSessionId: id });
    if (id) {
      // Only load messages if not already in store — SSE keeps them up-to-date
      // Reloading while a session is active would overwrite streaming data
      if (!(id in get().messages)) {
        get().loadMessages(id);
      }
      // Sync artifact panel to show this session's artifacts
      const msgs = get().messages[id] ?? [];
      const latestAssistant = [...msgs]
        .reverse()
        .find((m) => m.role === "assistant");
      useArtifactStore.getState().syncToSession(id, latestAssistant?.id);
      // Clear any open right panel page when navigating to a session
      useSettingsStore.getState().setRightPanelPage(null);
    }
  },

  loadSessions: async () => {
    set({ loading: true });
    try {
      const directory = useServerStore.getState().directory;
      const list = await api.listSessions();
      const sessionDirectories = { ...get().sessionDirectories };
      const sessions: Record<string, Session> = directory
        ? Object.fromEntries(
            Object.entries(get().sessions).filter(
              ([, session]) => session.directory !== directory,
            ),
          )
        : {};
      for (const s of list) {
        const scoped = withDirectory(s, directory);
        sessions[scoped.id] = scoped;
        if (scoped.directory) sessionDirectories[scoped.id] = scoped.directory;
      }
      set({ sessions, sessionDirectories, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  loadMessages: async (sessionId) => {
    try {
      const directory = getSessionDirectory(get(), sessionId);
      // API returns { info: Message, parts: Part[] }[]
      const response = await api.getMessages(sessionId, directory);
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
    const scopedSession = withDirectory(session, directory);
    set((s) => ({
      sessions: { ...s.sessions, [scopedSession.id]: scopedSession },
      sessionDirectories: {
        ...s.sessionDirectories,
        [scopedSession.id]: scopedSession.directory,
      },
      activeSessionId: scopedSession.id,
    }));
    return scopedSession;
  },

  deleteSession: async (id) => {
    const directory = getSessionDirectory(get(), id);
    await api.deleteSession(id, directory);
    set((s) => {
      const { [id]: _, ...rest } = s.sessions;
      const { [id]: _dir, ...sessionDirectories } = s.sessionDirectories;
      return {
        sessions: rest,
        sessionDirectories,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    });
  },

  /**
   * Delete every session the sidecar has bound to `directory`. Returns how many
   * sessions were removed. Best-effort: if the sidecar is unreachable we skip
   * silently so that project deletion can still proceed.
   */
  deleteSessionsForDirectory: async (directory) => {
    let sessions: Session[] = [];
    try {
      sessions = await api.listSessionsForDirectory(directory);
    } catch {
      return 0;
    }
    const deletedIds: string[] = [];
    for (const s of sessions) {
      try {
        await api.deleteSessionInDirectory(s.id, directory);
        deletedIds.push(s.id);
      } catch {
        // best-effort: skip failures and continue
      }
    }
    if (deletedIds.length > 0) {
      const deletedSet = new Set(deletedIds);
      set((state) => {
        const nextSessions: Record<string, Session> = {};
        for (const [id, sess] of Object.entries(state.sessions)) {
          if (!deletedSet.has(id)) nextSessions[id] = sess;
        }
        const sessionDirectories: Record<string, string> = {};
        for (const [id, dir] of Object.entries(state.sessionDirectories)) {
          if (!deletedSet.has(id)) sessionDirectories[id] = dir;
        }
        return {
          sessions: nextSessions,
          sessionDirectories,
          activeSessionId:
            state.activeSessionId && deletedSet.has(state.activeSessionId)
              ? null
              : state.activeSessionId,
        };
      });
    }
    return deletedIds.length;
  },

  /**
   * Scan the locally-cached sessions for directories that no longer exist on
   * disk. Returns one entry per orphaned directory with the session IDs bound
   * to it so a confirm-before-delete UI can preview what will go away.
   */
  findOrphanSessions: async () => {
    const state = get();
    const byDir = new Map<string, { ids: string[]; titles: string[] }>();
    for (const s of Object.values(state.sessions)) {
      if (!s.directory) continue;
      const entry = byDir.get(s.directory) ?? { ids: [], titles: [] };
      entry.ids.push(s.id);
      entry.titles.push(s.title || s.id);
      byDir.set(s.directory, entry);
    }
    const orphans: {
      directory: string;
      sessionIds: string[];
      titles: string[];
    }[] = [];
    for (const [dir, entry] of byDir.entries()) {
      const exists = await window.api.pathExists(dir).catch(() => false);
      if (!exists) {
        orphans.push({
          directory: dir,
          sessionIds: entry.ids,
          titles: entry.titles,
        });
      }
    }
    return orphans;
  },

  /**
   * Delete every session whose directory no longer exists on disk. Returns the
   * total number of sessions removed.
   */
  cleanupOrphanSessions: async () => {
    const orphans = await get().findOrphanSessions();
    let total = 0;
    for (const o of orphans) {
      total += await get().deleteSessionsForDirectory(o.directory);
    }
    return total;
  },

  archiveSession: async (id) => {
    const directory = getSessionDirectory(get(), id);
    const updated = withDirectory(
      await api.updateSession(
        id,
        {
          time: { archived: Date.now() },
        },
        directory,
      ),
      directory,
    );
    set((s) => ({
      sessions: { ...s.sessions, [id]: updated },
      sessionDirectories: updated.directory
        ? { ...s.sessionDirectories, [id]: updated.directory }
        : s.sessionDirectories,
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }));
  },

  unarchiveSession: async (id) => {
    const directory = getSessionDirectory(get(), id);
    const updated = withDirectory(
      await api.updateSession(id, { time: { archived: 0 } }, directory),
      directory,
    );
    set((s) => ({
      sessions: { ...s.sessions, [id]: updated },
      sessionDirectories: updated.directory
        ? { ...s.sessionDirectories, [id]: updated.directory }
        : s.sessionDirectories,
    }));
  },

  sendPrompt: async (sessionId, parts, options) => {
    const directory = getSessionDirectory(get(), sessionId);
    await api.sendPrompt(sessionId, parts, options, directory);
  },

  abortSession: async (id) => {
    const directory = getSessionDirectory(get(), id);
    await api.abortSession(id, directory);
  },

  // SSE handlers
  upsertSession: (session, directory) =>
    set((s) => {
      const scoped = withDirectory(
        session,
        directory ||
          s.sessions[session.id]?.directory ||
          s.sessionDirectories[session.id],
      );
      return {
        sessions: { ...s.sessions, [scoped.id]: scoped },
        sessionDirectories: scoped.directory
          ? { ...s.sessionDirectories, [scoped.id]: scoped.directory }
          : s.sessionDirectories,
      };
    }),

  removeSession: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.sessions;
      const { [id]: _dir, ...sessionDirectories } = s.sessionDirectories;
      return {
        sessions: rest,
        sessionDirectories,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    }),

  rememberSessionDirectory: (id, directory) => {
    if (!directory) return;
    set((s) => ({
      sessionDirectories: { ...s.sessionDirectories, [id]: directory },
      sessions: s.sessions[id]
        ? { ...s.sessions, [id]: withDirectory(s.sessions[id], directory) }
        : s.sessions,
    }));
  },

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

  upsertTodos: (sessionId, todos) =>
    set((s) => ({
      todos: { ...s.todos, [sessionId]: todos },
    })),

  loadTodos: async (sessionId) => {
    try {
      const directory = getSessionDirectory(get(), sessionId);
      const todos = await api.getTodos(sessionId, directory);
      set((s) => ({
        todos: { ...s.todos, [sessionId]: todos },
      }));
    } catch {
      /* silent */
    }
  },

  loadSessionDiff: async (sessionId) => {
    try {
      const directory = getSessionDirectory(get(), sessionId);
      const diff = await api.getSessionDiff(sessionId, directory);
      set((s) => ({
        sessionDiffs: { ...s.sessionDiffs, [sessionId]: diff },
      }));
    } catch {
      // silent — network/sidecar flakiness should not break the UI
    }
  },

  upsertPendingQuestion: (request) =>
    set((s) => {
      const key = request.tool?.callID ?? request.id;
      const existing = s.pendingQuestions[request.sessionID] ?? {};
      return {
        pendingQuestions: {
          ...s.pendingQuestions,
          [request.sessionID]: { ...existing, [key]: request },
        },
      };
    }),

  loadMcpStatus: async () => {
    try {
      const status = await api.getMCPStatus();
      set({ mcpStatus: status });
    } catch {
      /* silent */
    }
  },

  loadLspStatus: async () => {
    try {
      const status = await api.getLspStatus();
      set({ lspStatus: status });
    } catch {
      /* silent */
    }
  },

  loadProviders: async () => {
    try {
      const res = await api.listProviders();
      set({ providers: res.all ?? [] });
    } catch {
      /* silent */
    }
  },

  clearPendingQuestion: (sessionId, requestId) =>
    set((s) => {
      const existing = s.pendingQuestions[sessionId];
      if (!existing) return {};
      const next: Record<string, QuestionRequest> = {};
      for (const [key, req] of Object.entries(existing)) {
        if (req.id !== requestId) next[key] = req;
      }
      return {
        pendingQuestions: { ...s.pendingQuestions, [sessionId]: next },
      };
    }),

  setPendingCommand: (sessionId, commandName) =>
    set((s) => ({
      // Store as sessionId → commandName; consumed by upsertMessage
      _pendingCommands: { ...s._pendingCommands, [sessionId]: commandName },
    })),
}));
