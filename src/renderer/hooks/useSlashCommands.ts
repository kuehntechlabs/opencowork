import { useMemo, useCallback, useState, useEffect } from "react";
import { useSessionStore } from "../stores/session-store";
import { useSettingsStore } from "../stores/settings-store";
import { useServerStore } from "../stores/server-store";
import { useProjectStore } from "../stores/project-store";
import * as api from "../api/client";
import type { CustomCommand } from "../api/client";

const inFlightUndoRedo = new Set<string>();

export interface SlashCommand {
  id: string;
  trigger: string;
  title: string;
  description: string;
  category: string;
  type: "builtin" | "custom";
  source?: "skill" | "mcp" | "command";
  disabled?: boolean;
  onSelect: (args: string) => void | boolean | Promise<void | boolean>;
}

export function useSlashCommands({
  onModelOpen,
  onVariantToggle,
  onExecuteCustomCommand,
  onRestorePrompt,
}: {
  onModelOpen?: () => void;
  onVariantToggle?: () => void;
  onExecuteCustomCommand?: (
    command: string,
    args: string,
  ) => void | boolean | Promise<void | boolean>;
  onRestorePrompt?: (text: string) => void;
} = {}) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const status = useSessionStore((s) =>
    activeSessionId ? s.sessionStatus[activeSessionId] : undefined,
  );
  const { selectedProvider, selectedModel } = useSettingsStore();
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const connected = useServerStore((s) => s.connected);
  const setDirectory = useServerStore((s) => s.setDirectory);
  const addRecentDirectory = useProjectStore((s) => s.addRecentDirectory);

  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);

  // Fetch custom commands (skills, MCPs) from the backend
  useEffect(() => {
    if (!connected) return;
    api
      .listCommands()
      .then(setCustomCommands)
      .catch(() => {});
  }, [connected]);

  const notifyUnavailable = useCallback((feature: string) => {
    window.api
      .showNotification(
        "Not available in OpenCowork",
        `${feature} is not available in this UI yet.`,
      )
      .catch(() => {});
  }, []);

  const startNewSession = useCallback(() => {
    useSessionStore.getState().setActiveSession(null);
  }, []);

  const openDirectory = useCallback(async () => {
    const path = await window.api.openDirectoryPicker();
    if (!path) return;
    setDirectory(path);
    addRecentDirectory(path);
  }, [setDirectory, addRecentDirectory]);

  const undo = useCallback(async () => {
    if (!activeSessionId) return false;
    if (inFlightUndoRedo.has(activeSessionId)) return true;

    const state = useSessionStore.getState();
    const session = state.sessions[activeSessionId];
    const msgs = state.messages[activeSessionId] ?? [];
    const pointer = session?.revert?.messageID;
    const target = [...msgs]
      .reverse()
      .find((m) => m.role === "user" && (!pointer || m.id < pointer));
    if (!target) {
      window.api
        .showNotification("Nothing to undo", "No earlier user message found.")
        .catch(() => {});
      return false;
    }

    inFlightUndoRedo.add(activeSessionId);
    try {
      if (status?.type === "busy") {
        await api.abortSession(activeSessionId).catch(() => {});
      }
      try {
        await api.revertSession(activeSessionId, target.id);
      } catch (err) {
        console.error("Undo failed:", err);
        window.api
          .showNotification(
            "Undo failed",
            err instanceof Error
              ? err.message
              : "Could not revert the session.",
          )
          .catch(() => {});
        return false;
      }

      if (onRestorePrompt) {
        const parts = state.parts[target.id] ?? [];
        const text = parts
          .filter(
            (p): p is Extract<typeof p, { type: "text" }> =>
              p.type === "text" && !(p as { synthetic?: boolean }).synthetic,
          )
          .map((p) => p.text)
          .join("");
        onRestorePrompt(text);
      }

      await useSessionStore.getState().loadMessages(activeSessionId);
      return true;
    } finally {
      inFlightUndoRedo.delete(activeSessionId);
    }
  }, [activeSessionId, status, onRestorePrompt]);

  const redo = useCallback(async () => {
    if (!activeSessionId) return false;
    if (inFlightUndoRedo.has(activeSessionId)) return true;

    const state = useSessionStore.getState();
    const session = state.sessions[activeSessionId];
    const msgs = state.messages[activeSessionId] ?? [];
    const pointer = session?.revert?.messageID;
    if (!pointer) {
      window.api
        .showNotification("Nothing to redo", "No reverted messages.")
        .catch(() => {});
      return false;
    }
    const next = msgs.find((m) => m.role === "user" && m.id > pointer);

    inFlightUndoRedo.add(activeSessionId);
    try {
      if (status?.type === "busy") {
        await api.abortSession(activeSessionId).catch(() => {});
      }
      try {
        if (next) {
          await api.revertSession(activeSessionId, next.id);
        } else {
          await api.unrevertSession(activeSessionId);
        }
      } catch (err) {
        console.error("Redo failed:", err);
        window.api
          .showNotification(
            "Redo failed",
            err instanceof Error
              ? err.message
              : "Could not unrevert the session.",
          )
          .catch(() => {});
        return false;
      }
      onRestorePrompt?.("");
      await useSessionStore.getState().loadMessages(activeSessionId);
      return true;
    } finally {
      inFlightUndoRedo.delete(activeSessionId);
    }
  }, [activeSessionId, status, onRestorePrompt]);

  const compact = useCallback(async () => {
    if (!activeSessionId) return false;
    if (!selectedProvider || !selectedModel) {
      window.api
        .showNotification("Compact unavailable", "Select a model first")
        .catch(() => {});
      return true;
    }
    await api
      .summarizeSession(activeSessionId, selectedProvider, selectedModel)
      .catch((err) => {
        console.error("Compact failed:", err);
      });
    return true;
  }, [activeSessionId, selectedProvider, selectedModel]);

  const openModel = useCallback(() => {
    onModelOpen?.();
  }, [onModelOpen]);

  const toggleVariant = useCallback(() => {
    if (!selectedProvider || !selectedModel) {
      notifyUnavailable("Model variant");
      return;
    }
    onVariantToggle?.();
  }, [selectedProvider, selectedModel, notifyUnavailable, onVariantToggle]);

  const openCustomizeSection = useCallback(
    (section: "connectors" | "skills") => {
      setRightPanelPage("customize");
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(`opencowork:open-customize-${section}`),
        );
      }, 0);
    },
    [setRightPanelPage],
  );

  const openMcp = useCallback(() => {
    openCustomizeSection("connectors");
  }, [openCustomizeSection]);

  const openSkills = useCallback(() => {
    openCustomizeSection("skills");
  }, [openCustomizeSection]);

  const commands = useMemo<SlashCommand[]>(() => {
    // Custom commands from backend (skills, MCPs)
    const custom: SlashCommand[] = customCommands.map((cmd) => ({
      id: `custom.${cmd.name}`,
      trigger: cmd.name,
      title: cmd.name,
      description: cmd.description,
      category:
        cmd.source === "skill"
          ? "Skill"
          : cmd.source === "mcp"
            ? "MCP"
            : "Custom",
      type: "custom" as const,
      source: cmd.source,
      onSelect: (args) => onExecuteCustomCommand?.(cmd.name, args),
    }));

    // Built-in commands
    const builtin: SlashCommand[] = [
      {
        id: "session.new",
        trigger: "new",
        title: "New Session",
        description: "Start a new chat session",
        category: "Session",
        type: "builtin",
        onSelect: startNewSession,
      },
      {
        id: "file.open",
        trigger: "open",
        title: "Open Folder",
        description: "Choose and switch to another folder",
        category: "File",
        type: "builtin",
        onSelect: openDirectory,
      },
      {
        id: "session.undo",
        trigger: "undo",
        title: "Undo",
        description: "Undo the last message",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId,
        onSelect: undo,
      },
      {
        id: "session.redo",
        trigger: "redo",
        title: "Redo",
        description: "Redo the last undone message",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId,
        onSelect: redo,
      },
      {
        id: "session.compact",
        trigger: "compact",
        title: "Compact",
        description: "Summarize the session to reduce context size",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId,
        onSelect: compact,
      },
      {
        id: "model.choose",
        trigger: "model",
        title: "Model",
        description: "Select a different model",
        category: "Model",
        type: "builtin",
        onSelect: openModel,
      },
      {
        id: "model.variant.cycle",
        trigger: "variant",
        title: "Variant",
        description: "Open the model variant picker",
        category: "Model",
        type: "builtin",
        onSelect: toggleVariant,
      },
      {
        id: "mcp.toggle",
        trigger: "mcp",
        title: "MCP",
        description: "Open customize connectors",
        category: "MCP",
        type: "builtin",
        onSelect: openMcp,
      },
      {
        id: "skills.open",
        trigger: "skills",
        title: "Skills",
        description: "Open customize skills",
        category: "Skills",
        type: "builtin",
        onSelect: openSkills,
      },
    ];

    // Custom first, then builtins (matching opencode order)
    return [...custom, ...builtin.filter((c) => !c.disabled)];
  }, [
    startNewSession,
    openDirectory,
    activeSessionId,
    customCommands,
    undo,
    redo,
    compact,
    openModel,
    toggleVariant,
    openMcp,
    openSkills,
    notifyUnavailable,
    onExecuteCustomCommand,
  ]);

  const executeSlashText = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value.startsWith("/")) return false;
      const [head, ...tail] = value.split(/\s+/);
      const trigger = head.slice(1).toLowerCase();
      if (!trigger) return false;
      const args = tail.join(" ");
      const command = commands.find((c) => c.trigger.toLowerCase() === trigger);
      if (!command) return false;
      const result = await Promise.resolve(command.onSelect(args));
      if (result === false) return false;
      return true;
    },
    [commands],
  );

  const filterCommands = useCallback(
    (query: string) => {
      if (!query) return commands;
      const q = query.toLowerCase();
      return commands.filter(
        (c) =>
          c.trigger.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      );
    },
    [commands],
  );

  return { commands, filterCommands, executeSlashText };
}
