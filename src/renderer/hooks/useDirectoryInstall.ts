import { useState, useCallback } from "react";
import type { CatalogItem } from "../data/marketplace-catalog";

const api = (
  window as unknown as {
    api: import("../../preload/index").ElectronAPI;
  }
).api;

/**
 * Handles installing marketplace items:
 * - Skills: placeholder (no-op for now, would clone/download)
 * - Connectors (MCPs): adds entry to opencode config.json
 * - Plugins: placeholder (no-op for now, would npm install)
 */
export function useDirectoryInstall() {
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());

  const handleInstall = useCallback(async (item: CatalogItem) => {
    try {
      if (item.category === "connectors" && item.mcpCommand) {
        // Read current config, add MCP entry, write back
        const config = (await api.readProviderConfig()) as Record<
          string,
          unknown
        >;
        const mcp = (config.mcp as Record<string, unknown>) || {};
        mcp[item.name] = {
          type: "local",
          command: item.mcpCommand,
        };
        config.mcp = mcp;

        // Write the full config back (writeProviderConfig writes the provider key,
        // but we need the full config). We'll use the provider writer with the full config
        // by writing provider key. Actually we need a generic config writer.
        // For now, use the existing IPC which writes the full config's provider key.
        // We need a new IPC handler for this.
        await api.writeMCPConfig(mcp);
      }

      // Mark as installed (optimistic for skills/plugins since they're placeholders)
      setInstalledNames((prev) => new Set([...prev, item.name]));
    } catch (err) {
      console.error("Install failed:", err);
    }
  }, []);

  return { installedNames, handleInstall };
}
