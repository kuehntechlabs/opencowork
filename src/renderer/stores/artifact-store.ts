import { create } from "zustand";

export type ArtifactType = "react" | "html" | "notebook" | "browser";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content?: string;
  language?: string;
  filePath?: string;
  url?: string;
  sessionId: string;
  createdAt: number;
  /** True while the artifact is still streaming (content incomplete) */
  loading?: boolean;
  /** ID of the assistant message that produced this artifact */
  createdByMessageId?: string;
}

interface ArtifactState {
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  panelOpen: boolean;
  panelWidth: number;
  viewMode: "preview" | "code";

  addArtifact: (artifact: Omit<Artifact, "id" | "createdAt">) => string;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string | null) => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  setViewMode: (mode: "preview" | "code") => void;
  clearSessionArtifacts: (sessionId: string) => void;
  syncToSession: (sessionId: string, latestAssistantMessageId?: string) => void;
  updateArtifactContent: (id: string, content: string) => void;
  setArtifactLoading: (id: string, loading: boolean) => void;
}

let counter = 0;
function generateId(): string {
  return `artifact-${Date.now()}-${++counter}`;
}

const savedWidth = localStorage.getItem("artifact-panel-width");

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  artifacts: {},
  activeArtifactId: null,
  panelOpen: false,
  panelWidth: savedWidth ? parseInt(savedWidth, 10) : 500,
  viewMode: "preview",

  addArtifact: (artifact) => {
    const id = generateId();
    const full: Artifact = { ...artifact, id, createdAt: Date.now() };
    set((s) => {
      // Only auto-open the right panel once the artifact is fully built.
      // While streaming (loading: true) we track it silently and pop the
      // panel on the loading→done transition via `setArtifactLoading`.
      const reveal = !artifact.loading;
      return {
        artifacts: { ...s.artifacts, [id]: full },
        activeArtifactId: reveal ? id : s.activeArtifactId,
        panelOpen: reveal ? true : s.panelOpen,
      };
    });
    return id;
  },

  removeArtifact: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.artifacts;
      const newActive =
        s.activeArtifactId === id
          ? (Object.keys(rest)[0] ?? null)
          : s.activeArtifactId;
      return {
        artifacts: rest,
        activeArtifactId: newActive,
        panelOpen: newActive ? s.panelOpen : false,
      };
    }),

  setActiveArtifact: (id) =>
    set({ activeArtifactId: id, panelOpen: id ? true : false }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  setPanelOpen: (open) => set({ panelOpen: open }),

  setPanelWidth: (width) => {
    localStorage.setItem("artifact-panel-width", String(width));
    set({ panelWidth: width });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  clearSessionArtifacts: (sessionId) =>
    set((s) => {
      const filtered: Record<string, Artifact> = {};
      for (const [id, a] of Object.entries(s.artifacts)) {
        if (a.sessionId !== sessionId) filtered[id] = a;
      }
      const activeGone = s.activeArtifactId && !filtered[s.activeArtifactId];
      return {
        artifacts: filtered,
        activeArtifactId: activeGone
          ? (Object.keys(filtered)[0] ?? null)
          : s.activeArtifactId,
        panelOpen: activeGone ? false : s.panelOpen,
      };
    }),

  syncToSession: (sessionId, latestAssistantMessageId) =>
    set((s) => {
      const sessionArtifacts = Object.values(s.artifacts)
        .filter((a) => a.sessionId === sessionId)
        .sort((a, b) => b.createdAt - a.createdAt);

      if (sessionArtifacts.length === 0) {
        return { activeArtifactId: null, panelOpen: false };
      }

      const latest = sessionArtifacts[0];
      // Only auto-activate when the most recent artifact was produced by the
      // latest assistant message AND isn't still streaming.
      if (
        latestAssistantMessageId &&
        latest.createdByMessageId === latestAssistantMessageId &&
        !latest.loading
      ) {
        return { activeArtifactId: latest.id };
      }
      return { activeArtifactId: null, panelOpen: false };
    }),

  updateArtifactContent: (id, content) =>
    set((s) => {
      const existing = s.artifacts[id];
      if (!existing) return {};
      return {
        artifacts: { ...s.artifacts, [id]: { ...existing, content } },
      };
    }),

  setArtifactLoading: (id, loading) =>
    set((s) => {
      const existing = s.artifacts[id];
      if (!existing) return {};
      // When the artifact transitions from streaming → done, reveal it on
      // the right: activate it and open the panel.
      const justFinished = existing.loading === true && loading === false;
      return {
        artifacts: { ...s.artifacts, [id]: { ...existing, loading } },
        ...(justFinished
          ? { activeArtifactId: id, panelOpen: true }
          : {}),
      };
    }),
}));
