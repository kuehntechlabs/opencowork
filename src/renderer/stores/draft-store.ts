import { create } from "zustand";

interface DraftState {
  drafts: Record<string, string>;
  setDraft: (key: string, text: string) => void;
  clearDraft: (key: string) => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  drafts: {},

  setDraft: (key, text) =>
    set((s) => ({ drafts: { ...s.drafts, [key]: text } })),

  clearDraft: (key) =>
    set((s) => {
      const { [key]: _, ...drafts } = s.drafts;
      return { drafts };
    }),
}));
