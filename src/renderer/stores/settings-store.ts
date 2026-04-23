import { create } from "zustand";

export type Theme = "dark" | "light" | "system";
// Maps to opencode's native agent system:
// "ask" = build agent with permission prompts (always ask before making changes)
// "auto-accept" = build agent, auto-accept file edits (still ask for bash/dangerous)
// "plan" = plan agent (create a plan before making changes)
// "bypass" = build agent with ALL permissions auto-approved
export type PermissionMode = "ask" | "auto-accept" | "plan" | "bypass";
export type RightPanelPage = "projects" | "customize" | "directory" | null;
export type DirectoryCategory = "skills" | "connectors" | "plugins";
export type ModelVariant = string | null;

function modelVariantKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

interface SettingsState {
  theme: Theme;
  sidebarOpen: boolean;
  selectedProvider: string | null;
  selectedModel: string | null;
  selectedVariant: ModelVariant;
  variantByModel: Record<string, string | undefined>;
  settingsModalOpen: boolean;
  permissionMode: PermissionMode;
  rightPanelPage: RightPanelPage;
  directoryCategory: DirectoryCategory;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedModel: (provider: string, model: string) => void;
  setSelectedVariant: (variant: ModelVariant) => void;
  cycleSelectedVariant: () => void;
  setSettingsModalOpen: (open: boolean) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setRightPanelPage: (page: RightPanelPage) => void;
  openDirectory: (category: DirectoryCategory) => void;
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
  selectedVariant: null,
  variantByModel: {},
  settingsModalOpen: false,
  permissionMode: "ask" as PermissionMode,
  rightPanelPage: null as RightPanelPage,
  directoryCategory: "skills" as DirectoryCategory,

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

  setRightPanelPage: (page) => set({ rightPanelPage: page }),
  openDirectory: (category) =>
    set({ directoryCategory: category, rightPanelPage: "directory" }),

  setSelectedModel: (provider, model) => {
    localStorage.setItem("opencowork-provider", provider);
    localStorage.setItem("opencowork-model", model);
    const key = modelVariantKey(provider, model);
    const selectedVariant = get().variantByModel[key] ?? null;
    set({ selectedProvider: provider, selectedModel: model, selectedVariant });
  },

  setSelectedVariant: (variant) => {
    const provider = get().selectedProvider;
    const model = get().selectedModel;
    if (!provider || !model) {
      set({ selectedVariant: variant });
      return;
    }

    const key = modelVariantKey(provider, model);
    const nextMap = { ...get().variantByModel, [key]: variant ?? undefined };

    if (variant) {
      localStorage.setItem("opencowork-variant", variant);
    } else {
      localStorage.removeItem("opencowork-variant");
    }
    localStorage.setItem("opencowork-model-variants", JSON.stringify(nextMap));
    set({ selectedVariant: variant, variantByModel: nextMap });
  },

  cycleSelectedVariant: () => {
    // Default fallback cycle when explicit model variant list isn't available.
    const current = get().selectedVariant;
    const all: ModelVariant[] = [null, "low", "medium", "high"];
    const index = all.indexOf(current);
    const next = all[(index + 1) % all.length];
    get().setSelectedVariant(next);
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
const savedVariant = localStorage.getItem("opencowork-variant") as
  | ModelVariant
  | null;
const savedVariantByModelRaw = localStorage.getItem("opencowork-model-variants");
let savedVariantByModel: Record<string, string | undefined> = {};
if (savedVariantByModelRaw) {
  try {
    const parsed = JSON.parse(savedVariantByModelRaw) as Record<
      string,
      string | undefined
    >;
    if (parsed && typeof parsed === "object") {
      savedVariantByModel = parsed;
    }
  } catch {
    savedVariantByModel = {};
  }
}
if (typeof savedVariantByModel === "object") {
  useSettingsStore.setState({ variantByModel: savedVariantByModel });
}
if (savedProvider && savedModel) {
  const key = modelVariantKey(savedProvider, savedModel);
  useSettingsStore.setState({
    selectedProvider: savedProvider,
    selectedModel: savedModel,
    selectedVariant: savedVariantByModel[key] ?? null,
  });
}
if (savedVariant && !useSettingsStore.getState().selectedVariant) {
  useSettingsStore.setState({ selectedVariant: savedVariant });
}
