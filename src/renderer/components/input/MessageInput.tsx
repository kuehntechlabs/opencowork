import { useState, useRef, useCallback, useMemo } from "react";
import { VoiceButton } from "./VoiceButton";
import { ComposerBar } from "./ComposerBar";
import { SlashPopover } from "./SlashPopover";
import {
  useSlashCommands,
  type SlashCommand,
} from "../../hooks/useSlashCommands";
import { useSettingsStore } from "../../stores/settings-store";
import { useSessionStore } from "../../stores/session-store";
import { useServerStore } from "../../stores/server-store";
import * as api from "../../api/client";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showComposerBar?: boolean;
  isBusy?: boolean;
  onAbort?: () => void;
}

export function MessageInput({
  onSend,
  disabled,
  placeholder,
  showComposerBar = true,
  isBusy,
  onAbort,
}: Props) {
  const [text, setText] = useState("");
  const [slashActive, setSlashActive] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const permissionMode = useSettingsStore((s) => s.permissionMode);
  const setPermissionMode = useSettingsStore((s) => s.setPermissionMode);
  const { selectedProvider, selectedModel } = useSettingsStore();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const connected = useServerStore((s) => s.connected);

  const executeCustomCommand = useCallback(
    async (command: string, args: string) => {
      if (!activeSessionId) return;
      const model =
        selectedProvider && selectedModel
          ? `${selectedProvider}/${selectedModel}`
          : undefined;
      await api
        .executeCommand(activeSessionId, command, args, { model })
        .catch((err) => {
          console.error("Command execution failed:", err);
        });
    },
    [activeSessionId, selectedProvider, selectedModel],
  );

  const { filterCommands } = useSlashCommands({
    onModelOpen: () => {
      window.dispatchEvent(new CustomEvent("opencowork:open-model-picker"));
    },
    onAgentCycle: () => {
      const modes = ["ask", "auto-accept", "plan", "bypass"] as const;
      const idx = modes.indexOf(permissionMode);
      const next = modes[(idx + 1) % modes.length];
      setPermissionMode(next);
    },
    onExecuteCustomCommand: executeCustomCommand,
  });

  // Determine if we're in slash mode — only the first word matters
  const trimmed = text.trimStart();
  const isSlashMode = trimmed.startsWith("/") && !trimmed.includes(" ");
  const slashQuery = isSlashMode ? trimmed.slice(1) : "";
  const filteredCommands = useMemo(
    () => (isSlashMode ? filterCommands(slashQuery) : []),
    [isSlashMode, slashQuery, filterCommands],
  );

  // Keep active in bounds
  const activeCommand = slashActive
    ? filteredCommands.find((c) => c.id === slashActive)
    : null;
  const effectiveActiveId =
    activeCommand?.id ?? filteredCommands[0]?.id ?? null;

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    if (cmd.type === "custom") {
      // Custom commands (skills): insert trigger text, let user press Enter to send
      setText(`/${cmd.trigger} `);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } else {
      // Built-in commands (model, agent, etc.): execute immediately
      cmd.onSelect();
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    }
  }, []);

  const clearInput = useCallback(() => {
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;

    // If in slash mode and there's an active command, select it first
    if (isSlashMode && effectiveActiveId) {
      const cmd = filteredCommands.find((c) => c.id === effectiveActiveId);
      if (cmd) {
        if (cmd.type === "custom") {
          // Insert command text, user presses Enter again to execute
          setText(`/${cmd.trigger} `);
          return;
        }
        cmd.onSelect();
        clearInput();
        return;
      }
    }

    // Send everything through onSend — parent handles command detection
    onSend(text.trim());
    clearInput();
  }, [
    text,
    disabled,
    isSlashMode,
    effectiveActiveId,
    filteredCommands,
    onSend,
    clearInput,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSlashMode && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = filteredCommands.findIndex(
          (c) => c.id === effectiveActiveId,
        );
        const next = filteredCommands[(idx + 1) % filteredCommands.length];
        setSlashActive(next.id);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filteredCommands.findIndex(
          (c) => c.id === effectiveActiveId,
        );
        const prev =
          filteredCommands[
            (idx - 1 + filteredCommands.length) % filteredCommands.length
          ];
        setSlashActive(prev.id);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const cmd = filteredCommands.find((c) => c.id === effectiveActiveId);
        if (cmd) {
          setText("/" + cmd.trigger);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setText("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setSlashActive(null); // Reset to first on input change
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setText((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);

  return (
    <div className="relative rounded-xl border border-border bg-surface-secondary focus-within:border-accent">
      {/* Slash command popover */}
      {isSlashMode && (
        <SlashPopover
          commands={filteredCommands}
          activeId={effectiveActiveId}
          onSelect={handleSlashSelect}
          onActiveChange={setSlashActive}
        />
      )}

      {/* Textarea row */}
      <div className="flex items-end gap-2 p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type a message or / for commands..."}
          disabled={disabled}
          rows={1}
          className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center gap-1">
          <VoiceButton onTranscript={handleVoiceTranscript} />
          {isBusy ? (
            <button
              onClick={onAbort}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-500 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              title="Stop generating"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={disabled || !text.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Composer toolbar */}
      {showComposerBar && (
        <div className="border-t border-border/20 px-3 py-1.5">
          <ComposerBar />
        </div>
      )}
    </div>
  );
}
