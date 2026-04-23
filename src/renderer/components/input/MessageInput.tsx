import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
import type { FilePartInput } from "../../api/types";

interface Attachment extends FilePartInput {
  id: string;
  size: number;
}

interface Props {
  onSend: (text: string, attachments?: FilePartInput[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showComposerBar?: boolean;
  isBusy?: boolean;
  onAbort?: () => void;
}

function computeMaxHeight(): number {
  return Math.floor(window.innerHeight / 3);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const buf = await file.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buf));
  const mime = file.type || "application/octet-stream";
  const filename = file.name || `pasted.${mime.split("/")[1] || "bin"}`;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "file",
    mime,
    filename,
    url: `data:${mime};base64,${base64}`,
    size: file.size,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>(() => computeMaxHeight());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mouseGuardUntilRef = useRef(0);

  const permissionMode = useSettingsStore((s) => s.permissionMode);
  const setPermissionMode = useSettingsStore((s) => s.setPermissionMode);
  const { selectedProvider, selectedModel, selectedVariant } =
    useSettingsStore();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const connected = useServerStore((s) => s.connected);

  const cyclePermissionMode = useCallback(
    (direction: 1 | -1 = 1) => {
      const modes = ["ask", "auto-accept", "plan", "bypass"] as const;
      const currentIndex = modes.indexOf(permissionMode);
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (baseIndex + direction + modes.length) % modes.length;
      setPermissionMode(modes[nextIndex]);
    },
    [permissionMode, setPermissionMode],
  );

  const executeCustomCommand = useCallback(
    async (command: string, args: string) => {
      if (!activeSessionId) return false;
      const model =
        selectedProvider && selectedModel
          ? `${selectedProvider}/${selectedModel}`
          : undefined;
      await api
        .executeCommand(activeSessionId, command, args, {
          model,
          variant: selectedVariant ?? undefined,
        })
        .catch((err) => {
          console.error("Command execution failed:", err);
        });
      return true;
    },
    [activeSessionId, selectedProvider, selectedModel, selectedVariant],
  );

  const { filterCommands, executeSlashText } = useSlashCommands({
    onModelOpen: () => {
      window.dispatchEvent(new CustomEvent("opencowork:open-model-picker"));
    },
    onVariantToggle: () => {
      window.dispatchEvent(new CustomEvent("opencowork:toggle-variant-picker"));
    },
    onExecuteCustomCommand: executeCustomCommand,
    onRestorePrompt: (restored) => {
      setText(restored);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    },
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

  useEffect(() => {
    if (!isSlashMode) {
      if (slashActive !== null) setSlashActive(null);
      return;
    }
    if (filteredCommands.length === 0) {
      if (slashActive !== null) setSlashActive(null);
      return;
    }
    if (!slashActive || !filteredCommands.some((c) => c.id === slashActive)) {
      setSlashActive(filteredCommands[0].id);
    }
  }, [isSlashMode, filteredCommands, slashActive]);

  const setActiveFromMouse = useCallback((id: string) => {
    if (Date.now() < mouseGuardUntilRef.current) return;
    setSlashActive(id);
  }, []);

  const moveSlashActive = useCallback(
    (delta: 1 | -1) => {
      if (filteredCommands.length === 0) return;
      mouseGuardUntilRef.current = Date.now() + 300;
      setSlashActive((prev) => {
        const currentIndex = prev
          ? filteredCommands.findIndex((c) => c.id === prev)
          : 0;
        const index = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          (index + delta + filteredCommands.length) % filteredCommands.length;
        return filteredCommands[nextIndex].id;
      });
    },
    [filteredCommands],
  );

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    if (cmd.type === "custom") {
      // Custom commands (skills): insert trigger text, let user press Enter to send
      setText(`/${cmd.trigger} `);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } else {
      // Built-in commands (model, agent, etc.): execute immediately
      void cmd.onSelect("");
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    }
  }, []);

  const clearInput = useCallback(() => {
    setText("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const hasContent = text.trim().length > 0 || attachments.length > 0;

  const handleSend = useCallback(() => {
    if (!hasContent || disabled) return;

    // Match opencode behavior: when slash menu is open, Enter selects active item first.
    if (isSlashMode && effectiveActiveId) {
      const cmd = filteredCommands.find((c) => c.id === effectiveActiveId);
      if (cmd) {
        if (cmd.type === "custom") {
          // Insert command text, user presses Enter again to execute
          setText(`/${cmd.trigger} `);
          return;
        }
        void cmd.onSelect("");
        clearInput();
        return;
      }
    }

    const fileParts: FilePartInput[] = attachments.map(
      ({ id: _id, size: _size, ...rest }) => rest,
    );

    if (text.trimStart().startsWith("/") && attachments.length === 0) {
      void executeSlashText(text).then((handled) => {
        if (handled) {
          clearInput();
          return;
        }
        onSend(text.trim(), fileParts);
        clearInput();
      });
      return;
    }

    // Send plain prompts to parent
    onSend(text.trim(), fileParts);
    clearInput();
  }, [
    hasContent,
    text,
    attachments,
    disabled,
    executeSlashText,
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
        moveSlashActive(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSlashActive(-1);
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

    if (e.key === "Tab") {
      e.preventDefault();
      cyclePermissionMode(e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resizeTextarea = useCallback((cap: number) => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, cap) + "px";
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setSlashActive(null); // Reset to first on input change
    resizeTextarea(maxHeight);
  };

  useEffect(() => {
    const onResize = () => {
      const next = computeMaxHeight();
      setMaxHeight(next);
      resizeTextarea(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeTextarea]);

  useEffect(() => {
    resizeTextarea(maxHeight);
  }, [text, maxHeight, resizeTextarea]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const next = await Promise.all(arr.map((f) => fileToAttachment(f)));
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        await addFiles(files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles],
  );

  const handlePickAttachments = useCallback(async () => {
    const picked = await window.api.pickAttachments();
    if (!picked || picked.length === 0) return;
    const mapped: Attachment[] = picked.map((p) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "file",
      mime: p.mime,
      filename: p.filename,
      url: p.url,
      size: p.size,
    }));
    setAttachments((prev) => [...prev, ...mapped]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div
      className={
        "relative rounded-xl border bg-surface-secondary focus-within:border-accent " +
        (isDragOver ? "border-accent" : "border-border")
      }
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Slash command popover */}
      {isSlashMode && (
        <SlashPopover
          commands={filteredCommands}
          activeId={effectiveActiveId}
          onSelect={handleSlashSelect}
          onActiveChange={setActiveFromMouse}
        />
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {attachments.map((att) => {
            const isImage = att.mime.startsWith("image/");
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
              >
                {isImage ? (
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-secondary text-text-tertiary">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="max-w-[180px] truncate">{att.filename}</span>
                  <span className="text-text-tertiary">
                    {formatSize(att.size)}
                  </span>
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text"
                  title="Remove"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Textarea row */}
      <div className="flex items-end gap-2 p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder ?? "Type a message or / for commands..."}
          disabled={disabled}
          rows={1}
          style={{ maxHeight }}
          className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-text-tertiary focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handlePickAttachments}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface hover:text-text"
            title="Attach files"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.58 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
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
              disabled={disabled || !hasContent}
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
