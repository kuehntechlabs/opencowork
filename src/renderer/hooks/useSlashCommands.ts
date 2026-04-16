import { useMemo, useCallback, useState, useEffect } from "react";
import { useSessionStore } from "../stores/session-store";
import { useSettingsStore } from "../stores/settings-store";
import { useServerStore } from "../stores/server-store";
import { useProjectStore } from "../stores/project-store";
import * as api from "../api/client";
import type { CustomCommand } from "../api/client";

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
  onAgentCycle,
  onExecuteCustomCommand,
}: {
  onModelOpen?: () => void;
  onVariantToggle?: () => void;
  onAgentCycle?: () => void;
  onExecuteCustomCommand?: (
    command: string,
    args: string,
  ) => void | boolean | Promise<void | boolean>;
} = {}) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const messages = useSessionStore((s) => s.messages);
  const sessionStatus = useSessionStore((s) => s.sessionStatus);
  const { selectedProvider, selectedModel } = useSettingsStore();
  const setRightPanelPage = useSettingsStore((s) => s.setRightPanelPage);
  const connected = useServerStore((s) => s.connected);
  const setDirectory = useServerStore((s) => s.setDirectory);
  const addRecentDirectory = useProjectStore((s) => s.addRecentDirectory);

  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);

  // Fetch custom commands (skills, MCPs) from the backend
  useEffect(() => {
    if (!connected) return;
    api.listCommands().then(setCustomCommands).catch(() => {});
  }, [connected]);

  const session = activeSessionId ? sessions[activeSessionId] : null;
  const sessionMessages = activeSessionId
    ? messages[activeSessionId] ?? []
    : [];
  const userMessages = sessionMessages.filter((m) => m.role === "user");
  const status = activeSessionId
    ? sessionStatus[activeSessionId]
    : undefined;
  const isBusy = status?.type === "busy";
  const hasMessages = userMessages.length > 0;

  const undo = useCallback(async () => {
    if (!activeSessionId) return;
    if (isBusy) {
      await api.abortSession(activeSessionId).catch(() => {});
    }
    await api.revertSession(activeSessionId).catch((err) => {
      console.error("Undo failed:", err);
    });
    await useSessionStore.getState().loadMessages(activeSessionId);
  }, [activeSessionId, isBusy]);

  const redo = useCallback(async () => {
    if (!activeSessionId) return;
    await api.unrevertSession(activeSessionId).catch((err) => {
      console.error("Redo failed:", err);
    });
    await useSessionStore.getState().loadMessages(activeSessionId);
  }, [activeSessionId]);

  const compact = useCallback(async () => {
    if (!activeSessionId) return;
    if (!selectedProvider || !selectedModel) {
      console.warn("No model selected for compact");
      return;
    }
    await api
      .summarizeSession(activeSessionId, selectedProvider, selectedModel)
      .catch((err) => {
        console.error("Compact failed:", err);
      });
  }, [activeSessionId, selectedProvider, selectedModel]);

  const notifyUnavailable = useCallback((feature: string) => {
    window.api
      .showNotification("Not available in OpenCowork", `${feature} is not available in this UI yet.`)
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

  const fork = useCallback(async () => {
    if (!activeSessionId) return;
    const directory = useServerStore.getState().directory;
    if (!directory) return;
    try {
      const { permissionMode } = useSettingsStore.getState();
      const action = permissionMode === "bypass" ? "allow" : "ask";
      const newSession = await useSessionStore
        .getState()
        .createSession(directory, action);
      useSessionStore.getState().setActiveSession(newSession.id);
    } catch (err) {
      console.error("Fork failed:", err);
    }
  }, [activeSessionId]);

  const share = useCallback(async () => {
    if (!activeSessionId) return;
    if (session?.share?.url) {
      await navigator.clipboard.writeText(session.share.url).catch(() => {});
      return;
    }
    try {
      const url = await api.shareSession(activeSessionId);
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [activeSessionId, session]);

  const unshare = useCallback(async () => {
    if (!activeSessionId) return;
    await api.unshareSession(activeSessionId).catch((err) => {
      console.error("Unshare failed:", err);
    });
  }, [activeSessionId]);

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

  const cycleAgent = useCallback(() => {
    onAgentCycle?.();
  }, [onAgentCycle]);

  const openMcp = useCallback(() => {
    setRightPanelPage("customize");
    window.dispatchEvent(new CustomEvent("opencowork:open-customize-connectors"));
  }, [setRightPanelPage]);

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
      onSelect: (args) => {
        return onExecuteCustomCommand?.(cmd.name, args);
      },
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
        disabled: !activeSessionId || !hasMessages,
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
        disabled:
          !activeSessionId ||
          !hasMessages ||
          !selectedProvider ||
          !selectedModel,
        onSelect: compact,
      },
      {
        id: "session.fork",
        trigger: "fork",
        title: "Fork",
        description: "Create a new session from the current one",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId || !hasMessages,
        onSelect: fork,
      },
      {
        id: "session.share",
        trigger: "share",
        title: session?.share?.url ? "Copy share link" : "Share",
        description: session?.share?.url
          ? "Copy the share URL to clipboard"
          : "Share this session and copy the URL",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId,
        onSelect: share,
      },
      {
        id: "session.unshare",
        trigger: "unshare",
        title: "Unshare",
        description: "Stop sharing this session",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId || !session?.share?.url,
        onSelect: unshare,
      },
      {
        id: "session.status",
        trigger: "status",
        title: "Status",
        description: "Show current session status",
        category: "Session",
        type: "builtin",
        disabled: !activeSessionId,
        onSelect: () => {
          const s = activeSessionId
            ? useSessionStore.getState().sessionStatus[activeSessionId]
            : undefined;
          const statusText = s?.type ?? "idle";
          const msgCount = userMessages.length;
          const info = [
            `Status: ${statusText}`,
            `Messages: ${msgCount}`,
            selectedModel ? `Model: ${selectedModel}` : null,
            selectedProvider ? `Provider: ${selectedProvider}` : null,
          ]
            .filter(Boolean)
            .join(" | ");
          console.log("[session status]", info);
        },
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
        description: "Toggle MCP servers",
        category: "MCP",
        type: "builtin",
        onSelect: openMcp,
      },
      {
        id: "agent.cycle",
        trigger: "agent",
        title: "Agent",
        description: "Switch to the next agent",
        category: "Agent",
        type: "builtin",
        onSelect: cycleAgent,
      },
      {
        id: "terminal.toggle",
        trigger: "terminal",
        title: "Terminal",
        description: "Open terminal panel",
        category: "View",
        type: "builtin",
        onSelect: () => notifyUnavailable("Terminal panel"),
      },
      {
        id: "workspace.toggle",
        trigger: "workspace",
        title: "Workspace",
        description: "Toggle workspace mode",
        category: "Workspace",
        type: "builtin",
        onSelect: () => notifyUnavailable("Workspace mode"),
      },
    ];

    // Custom first, then builtins (matching opencode order)
    return [...custom, ...builtin.filter((c) => !c.disabled)];
  }, [
    startNewSession,
    openDirectory,
    activeSessionId,
    hasMessages,
    selectedProvider,
    selectedModel,
    session,
    customCommands,
    undo,
    redo,
    compact,
    fork,
    share,
    unshare,
    openModel,
    toggleVariant,
    openMcp,
    cycleAgent,
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
