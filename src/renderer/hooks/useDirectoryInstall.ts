import { useState, useCallback, useEffect } from "react";
import type { CatalogItem } from "../data/marketplace-catalog";

const api = (
  window as unknown as {
    api: import("../../preload/index").ElectronAPI;
  }
).api;

export function useDirectoryInstall() {
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  const refreshInstalled = useCallback(async () => {
    const names = await api.listInstalledSkills();
    setInstalledNames(new Set(names));
  }, []);

  // Load installed skills on mount
  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const handleInstall = useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.category === "connectors" && item.mcpCommand) {
          await api.writeMCPConfig({
            [item.name]: { type: "local", command: item.mcpCommand },
          });
          setInstalledNames((prev) => new Set([...prev, item.name]));
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
            // Refresh the full list so CustomizePage also sees the new skill
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
    [refreshInstalled],
  );

  const handleRemove = useCallback(
    async (skillName: string) => {
      setInstalling((prev) => new Set([...prev, skillName]));

      try {
        const result = await api.removeSkill(skillName);

        setInstalling((prev) => {
          const next = new Set(prev);
          next.delete(skillName);
          return next;
        });

        if (result.ok) {
          await refreshInstalled();
        } else {
          console.error("Skill remove failed:", result.output);
        }
      } catch (err) {
        console.error("Remove failed:", err);
        setInstalling((prev) => {
          const next = new Set(prev);
          next.delete(skillName);
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
  };
}
