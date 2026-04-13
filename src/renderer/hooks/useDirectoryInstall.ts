import { useState, useCallback, useEffect, useRef } from "react";
import type { CatalogItem } from "../data/marketplace-catalog";
import { setBaseUrl, checkHealth } from "../api/client";
import { connectSSE, disconnectSSE } from "../api/events";
import { useServerStore } from "../stores/server-store";

const api = (
  window as unknown as {
    api: import("../../preload/index").ElectronAPI;
  }
).api;

/** Describes a pending prompt modal for collecting key-value config */
export interface ConfigPrompt {
  /** Title shown in the modal */
  title: string;
  /** Fields to collect: key → description */
  fields: { key: string; label: string; secret?: boolean }[];
}

/** Restart the sidecar and reconnect the renderer to the new URL */
export async function restartAndReconnect(): Promise<void> {
  const newUrl = await api.restartSidecar();
  if (newUrl) {
    setBaseUrl(newUrl);
    const serverStore = useServerStore.getState();
    serverStore.setUrl(newUrl);
    disconnectSSE();

    for (let i = 0; i < 15; i++) {
      if (await checkHealth()) {
        serverStore.setConnected(true);
        serverStore.setNeedsRestart(false);
        connectSSE();
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Mark that a restart is needed without actually restarting */
function flagRestartNeeded(): void {
  useServerStore.getState().setNeedsRestart(true);
}

export function useDirectoryInstall() {
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  // Prompt modal state
  const [configPrompt, setConfigPrompt] = useState<ConfigPrompt | null>(null);
  const promptResolve = useRef<
    ((values: Record<string, string> | null) => void) | null
  >(null);

  /** Show a modal and wait for the user to fill in values (or cancel) */
  const promptForValues = useCallback(
    (prompt: ConfigPrompt): Promise<Record<string, string> | null> => {
      return new Promise((resolve) => {
        promptResolve.current = resolve;
        setConfigPrompt(prompt);
      });
    },
    [],
  );

  /** Called by the modal when the user submits */
  const submitPrompt = useCallback((values: Record<string, string>) => {
    promptResolve.current?.(values);
    promptResolve.current = null;
    setConfigPrompt(null);
  }, []);

  /** Called by the modal when the user cancels */
  const cancelPrompt = useCallback(() => {
    promptResolve.current?.(null);
    promptResolve.current = null;
    setConfigPrompt(null);
  }, []);

  const refreshInstalled = useCallback(async () => {
    const [skillNames, mcpServers] = await Promise.all([
      api.listInstalledSkills(),
      api.listMCPServers().catch(() => []),
    ]);
    const names = new Set(skillNames);
    for (const s of mcpServers) {
      names.add(s.name);
    }
    setInstalledNames(names);
  }, []);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const handleInstall = useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.category === "connectors") {
          const configName = item.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-");

          if (item.mcpCommand) {
            const config: Record<string, unknown> = {
              type: "local",
              command: item.mcpCommand,
            };

            if (item.mcpEnv) {
              const fields = Object.entries(item.mcpEnv).map(([key, desc]) => ({
                key,
                label: desc,
                secret:
                  key.toLowerCase().includes("key") ||
                  key.toLowerCase().includes("token") ||
                  key.toLowerCase().includes("secret"),
              }));
              const values = await promptForValues({
                title: `Configure ${item.name}`,
                fields,
              });
              if (!values) return; // cancelled
              config.env = values;
            }

            setInstalling((prev) => new Set([...prev, item.name]));
            await api.writeMCPConfig({ [configName]: config });
            flagRestartNeeded();
            setInstalling((prev) => {
              const next = new Set(prev);
              next.delete(item.name);
              return next;
            });
            setInstalledNames((prev) => new Set([...prev, item.name]));
            return;
          }

          if (item.mcpUrl) {
            const config: Record<string, unknown> = {
              type: "remote",
              url: item.mcpUrl,
            };

            if (item.mcpHeaders) {
              const fields = Object.entries(item.mcpHeaders).map(
                ([key, desc]) => ({
                  key,
                  label: desc,
                  secret: key.toLowerCase() === "authorization",
                }),
              );
              const values = await promptForValues({
                title: `Configure ${item.name}`,
                fields,
              });
              if (!values) return; // cancelled
              config.headers = values;
            }

            setInstalling((prev) => new Set([...prev, item.name]));
            await api.writeMCPConfig({ [configName]: config });
            flagRestartNeeded();
            setInstalling((prev) => {
              const next = new Set(prev);
              next.delete(item.name);
              return next;
            });
            setInstalledNames((prev) => new Set([...prev, item.name]));
            return;
          }

          // No env/headers needed — just install directly
          if (!item.mcpCommand && !item.mcpUrl) {
            console.warn("Connector has no install method:", item.name);
            return;
          }
          return;
        }

        if (item.category === "skills" || item.category === "plugins") {
          const parts = item.installRef.split("/");
          let source: string;
          let skillName: string;

          if (parts.length >= 3) {
            source = `${parts[0]}/${parts[1]}`;
            skillName = parts.slice(2).join("/");
          } else {
            source = item.installRef;
            skillName = item.name;
          }

          setInstalling((prev) => new Set([...prev, item.name]));

          const result = await api.installSkill(source, skillName);

          setInstalling((prev) => {
            const next = new Set(prev);
            next.delete(item.name);
            return next;
          });

          if (result.ok) {
            flagRestartNeeded();
            await refreshInstalled();
          } else {
            console.error("Skill install failed:", result.output);
          }
          return;
        }
      } catch (err) {
        console.error("Install failed:", err);
        setInstalling((prev) => {
          const next = new Set(prev);
          next.delete(item.name);
          return next;
        });
      }
    },
    [refreshInstalled, promptForValues],
  );

  const handleRemove = useCallback(
    async (itemName: string, category?: string) => {
      setInstalling((prev) => new Set([...prev, itemName]));

      try {
        if (category === "connectors") {
          // Remove MCP server from config
          const configName = itemName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
          await api.removeMCPConfig(configName);
          flagRestartNeeded();
          setInstalling((prev) => {
            const next = new Set(prev);
            next.delete(itemName);
            return next;
          });
          await refreshInstalled();
          return;
        }

        // Remove skill
        const result = await api.removeSkill(itemName);

        setInstalling((prev) => {
          const next = new Set(prev);
          next.delete(itemName);
          return next;
        });

        if (result.ok) {
          flagRestartNeeded();
          await refreshInstalled();
        } else {
          console.error("Skill remove failed:", result.output);
        }
      } catch (err) {
        console.error("Remove failed:", err);
        setInstalling((prev) => {
          const next = new Set(prev);
          next.delete(itemName);
          return next;
        });
      }
    },
    [refreshInstalled],
  );

  return {
    installedNames,
    installing,
    handleInstall,
    handleRemove,
    refreshInstalled,
    // Prompt modal state
    configPrompt,
    submitPrompt,
    cancelPrompt,
  };
}
