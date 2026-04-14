import { create } from "zustand";

interface ServerState {
  url: string | null;
  connected: boolean;
  directory: string;
  initializing: boolean;
  needsRestart: boolean;
  providersVersion: number;

  setUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setDirectory: (directory: string) => void;
  setInitializing: (initializing: boolean) => void;
  setNeedsRestart: (needsRestart: boolean) => void;
  bumpProviders: () => void;
}

export const useServerStore = create<ServerState>((set) => ({
  url: null,
  connected: false,
  directory: "",
  initializing: true,
  needsRestart: false,
  providersVersion: 0,

  setUrl: (url) => set({ url }),
  setConnected: (connected) => set({ connected }),
  setDirectory: (directory) => set({ directory }),
  setInitializing: (initializing) => set({ initializing }),
  setNeedsRestart: (needsRestart) => set({ needsRestart }),
  bumpProviders: () =>
    set((s) => ({ providersVersion: s.providersVersion + 1 })),
}));
