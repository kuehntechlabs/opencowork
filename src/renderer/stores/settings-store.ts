import { create } from "zustand";

export type Theme = "dark" | "light" | "system";
// Maps to opencode's native agent system:
// "allow" = build agent with all permissions auto-approved
// "ask" = build agent with permission prompts
// "plan" = plan agent (can only write to plan files)
export type PermissionMode = "allow" | "ask" | "plan";

interface SettingsState {
  theme: Theme;
  sidebarOpen: boolean;
  selectedProvider: string | null;
  selectedModel: string | null;
  settingsModalOpen: boolean;
  permissionMode: PermissionMode;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedModel: (provider: string, model: string) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setPermissionMode: (mode: PermissionMode) => void;
}

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "system",
  sidebarOpen: true,
  selectedProvider: null,
  selectedModel: null,
  settingsModalOpen: false,
  permissionMode: "ask",

  setTheme: (theme) => {
    applyTheme(theme);
    localStorage.setItem("opencowork-theme", theme);
    set({ theme });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setPermissionMode: (mode) => {
    localStorage.setItem("opencowork-permission-mode", mode);
    set({ permissionMode: mode });
  },

  setSelectedModel: (provider, model) => {
    localStorage.setItem("opencowork-provider", provider);
    localStorage.setItem("opencowork-model", model);
    set({ selectedProvider: provider, selectedModel: model });
  },
}));

// Initialize from localStorage
const savedTheme = localStorage.getItem("opencowork-theme") as Theme | null;
if (savedTheme) {
  useSettingsStore.getState().setTheme(savedTheme);
} else {
  // Apply system theme on first load
  applyTheme("system");
}
const savedMode = localStorage.getItem(
  "opencowork-permission-mode",
) as PermissionMode | null;
if (savedMode) {
  useSettingsStore.setState({ permissionMode: savedMode });
}
const savedProvider = localStorage.getItem("opencowork-provider");
const savedModel = localStorage.getItem("opencowork-model");
if (savedProvider && savedModel) {
  useSettingsStore.setState({
    selectedProvider: savedProvider,
    selectedModel: savedModel,
  });
}
