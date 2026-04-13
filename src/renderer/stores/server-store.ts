import { create } from "zustand";

interface ServerState {
  url: string | null;
  connected: boolean;
  directory: string;
  initializing: boolean;
  needsRestart: boolean;

  setUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setDirectory: (directory: string) => void;
  setInitializing: (initializing: boolean) => void;
  setNeedsRestart: (needsRestart: boolean) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  url: null,
  connected: false,
  directory: "",
  initializing: true,
  needsRestart: false,

  setUrl: (url) => set({ url }),
  setConnected: (connected) => set({ connected }),
  setDirectory: (directory) => set({ directory }),
  setInitializing: (initializing) => set({ initializing }),
  setNeedsRestart: (needsRestart) => set({ needsRestart }),
}));
