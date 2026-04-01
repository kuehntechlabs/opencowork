import { create } from "zustand";
import { setBaseUrl, checkHealth } from "../api/client";
import { connectSSE, disconnectSSE } from "../api/events";
import { useServerStore } from "./server-store";

export interface CloudProviderEntry {
  kind: "cloud";
  apiKey: string;
}

export interface LocalProviderEntry {
  kind: "local";
  name: string;
  npm: string;
  baseURL: string;
  models: Record<string, { name: string }>;
}

export type ProviderEntry = CloudProviderEntry | LocalProviderEntry;

interface ProviderConfigState {
  providers: Record<string, ProviderEntry>;
  loading: boolean;
  saving: boolean;

  loadConfig: () => Promise<void>;
  saveAndRestart: () => Promise<void>;
  setCloudProvider: (id: string, apiKey: string) => void;
  setLocalProvider: (
    id: string,
    entry: Omit<LocalProviderEntry, "kind">,
  ) => void;
  removeProvider: (id: string) => void;
}

export const CLOUD_PROVIDERS = [
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "google", name: "Google", placeholder: "AIza..." },
  { id: "groq", name: "Groq", placeholder: "gsk_..." },
  { id: "xai", name: "xAI", placeholder: "xai-..." },
  { id: "mistral", name: "Mistral", placeholder: "..." },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-..." },
] as const;

export const LOCAL_PRESETS = [
  {
    id: "ollama",
    name: "Ollama",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "http://localhost:11434/v1",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "http://localhost:1234/v1",
  },
  {
    id: "llamacpp",
    name: "llama.cpp",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "http://localhost:8080/v1",
  },
] as const;

// Parse opencode config format into our internal format
function parseConfig(
  raw: Record<string, unknown>,
): Record<string, ProviderEntry> {
  const provider = (raw.provider ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const result: Record<string, ProviderEntry> = {};

  for (const [id, cfg] of Object.entries(provider)) {
    const options = (cfg.options ?? {}) as Record<string, string>;

    if (cfg.npm || cfg.baseURL || options.baseURL) {
      // Local provider
      result[id] = {
        kind: "local",
        name: (cfg.name as string) || id,
        npm: (cfg.npm as string) || "@ai-sdk/openai-compatible",
        baseURL: options.baseURL || (cfg.baseURL as string) || "",
        models: (cfg.models as Record<string, { name: string }>) ?? {},
      };
    } else if (options.apiKey) {
      // Cloud provider with API key
      result[id] = {
        kind: "cloud",
        apiKey: options.apiKey,
      };
    }
  }

  return result;
}

// Serialize our internal format back to opencode config format
function serializeConfig(
  providers: Record<string, ProviderEntry>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [id, entry] of Object.entries(providers)) {
    if (entry.kind === "cloud") {
      result[id] = { options: { apiKey: entry.apiKey } };
    } else {
      result[id] = {
        npm: entry.npm,
        name: entry.name,
        options: { baseURL: entry.baseURL },
        models: entry.models,
      };
    }
  }

  return result;
}

export const useProviderConfigStore = create<ProviderConfigState>(
  (set, get) => ({
    providers: {},
    loading: false,
    saving: false,

    loadConfig: async () => {
      set({ loading: true });
      try {
        const config = await window.api.readProviderConfig();
        set({ providers: parseConfig(config), loading: false });
      } catch {
        set({ loading: false });
      }
    },

    saveAndRestart: async () => {
      set({ saving: true });
      try {
        const serialized = serializeConfig(get().providers);
        await window.api.writeProviderConfig(serialized);
        const newUrl = await window.api.restartSidecar();

        if (newUrl) {
          setBaseUrl(newUrl);
          const serverStore = useServerStore.getState();
          serverStore.setUrl(newUrl);
          disconnectSSE();

          // Wait for healthy
          for (let i = 0; i < 15; i++) {
            if (await checkHealth()) {
              serverStore.setConnected(true);
              connectSSE();
              break;
            }
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } finally {
        set({ saving: false });
      }
    },

    setCloudProvider: (id, apiKey) =>
      set((s) => ({
        providers: {
          ...s.providers,
          [id]: { kind: "cloud", apiKey },
        },
      })),

    setLocalProvider: (id, entry) =>
      set((s) => ({
        providers: {
          ...s.providers,
          [id]: { kind: "local", ...entry },
        },
      })),

    removeProvider: (id) =>
      set((s) => {
        const { [id]: _, ...rest } = s.providers;
        return { providers: rest };
      }),
  }),
);
